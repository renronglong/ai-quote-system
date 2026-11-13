"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileImage, ShieldAlert, ChevronDown, ExternalLink, Info, Box } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { calculateLaserCuttingFee } from '@/lib/stamping-mold-calculator';
import { tryFrontendDieCasting } from '@/lib/pricing/dieCastingFrontend';
import QuoteSidebarLayout from '@/components/QuoteSidebarLayout';

/**
 * /quote/parts/inspect — 业主 2026-11-12 任务表「修改任务」第 1 条
 *  1) 零件列表「加工方式」右侧按钮 → 本子网页显示后端给出的图纸
 *  2) 本页再加一个链接 → 查看后端给出的全部信息并翻译成通俗语言（管理员测试用，普通用户看不了）
 *
 * 图纸来源（业主 2026-11-12 17:59 定）：读后端响应顶层 drawing_preview_url，
 * 直接 <img src={值}>；值为 null / 空时显示已有空态说明。
 * findDrawingSources 仅作该字段缺失时的兜底，不是主路径。
 * 后端全部信息：buildRecogDataFromParse 里挂的 _rawBackend（原始完整响应）。
 */

type DrawingSource = { label: string; url: string; kind: 'image' | 'pdf' | 'link' };

/** 兜底：drawing_preview_url 为空时，递归找响应里任何像图纸的字段；限制深度与数量，避免误抓 OCR 长文本。 */
function findDrawingSources(obj: unknown): DrawingSource[] {
  const out: DrawingSource[] = [];
  const seen = new Set<string>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (out.length >= 12 || depth > 5) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length < 12 || s.length > 3_000_000 || seen.has(s)) return;
      const add = (kind: DrawingSource['kind']) => { seen.add(s); out.push({ label: path || '图纸', url: s, kind }); };
      if (/^data:image\//i.test(s)) add('image');
      else if (/^data:application\/pdf/i.test(s)) add('pdf');
      else if (/^https?:\/\//i.test(s) && /\.(png|jpe?g|webp|gif|bmp|svg|pdf)(\?|#|$)/i.test(s)) add(/\.pdf/i.test(s) ? 'pdf' : 'image');
      else if (/^https?:\/\//i.test(s) && /image|drawing|preview|snapshot|thumb|图纸|预览/i.test(path)) add('link');
      return;
    }
    if (Array.isArray(v)) { v.slice(0, 20).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(obj, '', 0);
  return out;
}

// 业主 2026-11-13：管理员专属「后端给出的全部信息」保持原样（一句话看懂 + 字段对照表 + 原始 JSON）。
// 普通用户看到的「基本信息」卡片见 buildBasicInfo。

/** 后端字段 → 中文大白话 */
const FIELD_LABELS: Record<string, string> = {
  drawing_preview_url: '图纸预览地址', file_name: '文件名', file_type: '文件类型', file_size_kb: '文件大小(KB)', parser_version: '解析器版本',
  parse_success: '解析是否成功', parse_errors: '解析错误', parser_errors: '解析错误',
  section_width_mm: '截面宽度(mm)', section_height_mm: '截面高度(mm)', section_size: '截面尺寸',
  width_mm: '宽度(mm)', height_mm: '高度(mm)', length_mm: '长度(mm)',
  circumscribed_diameter_mm: '外接圆直径(mm)', section_min_circle_diameter_mm: '最小外接圆直径(mm)',
  section_area_mm2: '截面积(mm²)', cross_section_area_mm2: '截面积(mm²)',
  outer_perimeter_mm: '外周长(mm)', inner_perimeter_mm: '内腔周长(mm)', perimeter_mm: '总周长(mm)',
  extrusion_length_mm: '型材长度(mm)', extrusion_axis: '挤出方向', wall_thickness_mm: '壁厚(mm)',
  material_thickness_mm: '板厚(mm)', thickness_mm: '板厚(mm)',
  weight_kg_per_m: '每米重量(kg/m)', meter_weight: '每米重量(kg/m)', weight_g: '单件重量(g)',
  is_sheet_metal: '是否钣金件', is_hollow: '是否中空', cavities: '内腔数量',
  product_type: '产品类型', process_type: '工艺类型', process_type_cn: '工艺类型(中文)',
  structure_type: '结构类型', area_method: '面积算法', classification: '分类判定',
  mold_type: '模具类型', die_type: '模具类型', material_grade: '材料牌号', material: '材料',
  surface_treatment: '表面处理', drawing_number: '图号', product_name: '产品名称',
  product_model: '产品型号', product_code: '产品编号', part_name: '零件名称',
  confidence: '识别置信度', confidence_score: '识别置信度', confidence_level: '置信度等级',
  raw_ocr_text: '图纸上读到的原始文字', parse_method: '识别方式', size_source: '尺寸来源',
  bbox: '三维包围盒', volume_mm3: '体积(mm³)', density_g_mm3: '密度(g/mm³)',
  bend_count: '折弯道数', bend_radius_mm: '折弯半径(mm)', bend_deduction_mm: '折弯扣除(mm)',
  unfold_length_mm: '展开长(mm)', unfold_width_mm: '展开宽(mm)', unfold_area_mm2: '展开面积(mm²)',
  cut_perimeter_mm: '切割周长(mm)', cut_total_path_mm: '切割总路径(mm)',
  punch_holes_total: '冲压孔数', cnc_total_holes: 'CNC孔数', cnc_holes: 'CNC孔明细',
  flat_segments: '展开分段', flat_length_mm: '展开长度(mm)', ocr_pages: 'OCR页数', total_pages: '总页数',
  products: '零件列表', quote_params: '报价参数', raw_parse: '原始解析结果',
  missing_fields: '缺失字段', quotable: '是否可报价', quote_warnings: '报价提示',
  note: '备注', source: '识别来源', needs_human: '是否需人工确认',
  // —— 以下补齐后端原始字段（2026-11-12 全量中文化，覆盖所有上传类型的顶层 key）——
  air_travel_mm: '截面行程(mm)',
  all_holes: '全部孔',
  all_holes_total: '孔总数',
  bend_angle_deg: '折弯角度(度)',
  bend_fillet_count: '折弯圆角数',
  bend_fillet_ratio: '折弯圆角占比',
  bends: '折弯明细',
  blank_length_mm: '毛坯长度(mm)',
  blank_section_area_mm2: '毛坯截面积(mm²)',
  blank_source: '毛坯数据来源',
  blank_volume_mm3: '毛坯体积(mm³)',
  bspline_faces: '样条曲面数',
  bspline_ratio: '样条曲面占比',
  clamp_count: '夹具数量',
  clamp_detail: '夹具明细',
  cnc_estimate: 'CNC工时估算',
  confidence_model: '置信度(模型)',
  cutting_volume_mm3: '切削体积(mm³)',
  cyl_radius_count: '圆柱半径计数',
  cylindrical_faces: '圆柱面数',
  decision_model: '工艺判定模型',
  decision_model_info: '工艺判定模型信息',
  decision_source: '判定依据来源',
  density_source: '密度数据来源',
  error: '错误信息',
  extrusion_features: '挤出特征',
  f1_constant_pairs: 'F1-等厚边对',
  f2_wire_info: 'F2-线框信息',
  f3_cv: 'F3-截面变异系数',
  f3_plat_ratio: 'F3-扁平比',
  f3_section_areas: 'F3-各截面面积',
  face_count: '面总数',
  fillet_count: '圆角数',
  fillet_ratio: '圆角占比',
  holes_perimeter_mm: '孔周长(mm)',
  inner_wires_count: '内轮廓线数',
  is_assembly: '是否装配体',
  lateral_holes: '侧向孔',
  machining_time_min: '机加工时长(分钟)',
  max_bend_length_mm: '最大折弯长度(mm)',
  measure_source: '测量数据来源',
  model_confidence: '模型置信度',
  part_count: '零件总数',
  part_number: '零件编号',
  parts: '零件明细(原始)',
  parts_count: '零件数',
  planar_faces: '平面数',
  projection_volume_mm3: '投影体积(mm³)',
  punch_holes: '冲压孔明细',
  removal_volume_mm3: '去除体积(mm³)',
  rule_confidence: '规则置信度',
  rule_engine_raw: '规则引擎原始输出',
  section_area_source: '截面积数据来源',
  section_perimeter_mm: '截面周长(mm)',
  side_axes: '侧向轴数',
  structure_v2: '结构类型(V2)',
  surface_area_mm2: '表面积(mm²)',
  thickness_direction: '厚度方向',
  tool_breakdown: '刀具分解',
  toolpath_mm: '刀路长度(mm)',
  total_pieces: '总件数',
  unfold_hole_count: '展开孔数',
  unfold_method: '展开算法',
  unfold_perimeter_mm: '展开周长(mm)',
  unfold_size: '展开尺寸',
  unfold_width_vs_perimeter: '展开宽/周长比',
  unique_part_count: '不同零件数',
  unquotable_count: '不可报价零件数',
  wall_thickness_cv: '壁厚变异系数',
  wall_thickness_source: '壁厚数据来源',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.length > 220 ? v.slice(0, 220) + '…' : v;
  try { const s = JSON.stringify(v); return s.length > 220 ? s.slice(0, 220) + '…' : s; } catch { return String(v); }
}

/** 把后端一堆字段拼成一段人话 */
function makePlainSummary(raw: any): string[] {
  const root = raw?.raw_parse?.stp || raw?.quote_params || raw || {};
  const g = (...keys: string[]) => {
    for (const k of keys) { const v = root?.[k]; if (v !== undefined && v !== null && v !== '' && v !== 'None') return v; }
    return undefined;
  };
  const lines: string[] = [];
  const name = g('product_name', 'part_name', 'file_name', 'drawing_number');
  const sheet = g('is_sheet_metal');
  const proc = g('process_type_cn', 'process_type', 'product_type');
  lines.push(`这个零件${name ? `叫「${name}」` : '没有取到名称'}，后端判定为【${sheet === true ? '钣金件' : proc ? String(proc) : '未明确类型'}】。`);
  const w = g('section_width_mm', 'width_mm', 'width');
  const h = g('section_height_mm', 'height_mm', 'height');
  const len = g('extrusion_length_mm', 'length_mm', 'length');
  if (w || h) lines.push(`截面尺寸：宽 ${w ?? '—'} mm × 高 ${h ?? '—'} mm${len ? `，型材长 ${len} mm` : ''}。`);
  const cd = g('circumscribed_diameter_mm', 'section_min_circle_diameter_mm');
  if (cd) lines.push(`外接圆直径 ${cd} mm（选模具时先看这个数，比用宽高对角线更准）。`);
  const area = g('section_area_mm2', 'cross_section_area_mm2');
  const mw = g('weight_kg_per_m', 'meter_weight');
  const wall = g('wall_thickness_mm', 'material_thickness_mm', 'thickness_mm');
  if (area || mw || wall) lines.push(`截面积 ${area ?? '—'} mm²，每米重 ${mw ?? '—'} kg，壁厚 ${wall ?? '—'} mm。`);
  const mold = g('mold_type', 'die_type');
  if (mold) lines.push(`建议模具类型：${mold}。`);
  const ok = g('parse_success');
  const conf = g('confidence_score', 'confidence');
  lines.push(`解析${ok === false ? '失败' : '成功'}${conf !== undefined ? `，识别置信度 ${conf}` : ''}。`);
  return lines;
}

/**
 * 3D 模型查看器（业主「前端任务_3D模型显示」）。
 * 后端把模型以 data:model/stl;base64,... 直接给出（无需再调接口）。
 * three / STLLoader / OrbitControls 均在 useEffect 内动态 import，避免 SSR 触碰 WebGL，
 * 也让 three 单独成 chunk、按需加载。
 * 模型默认灰色（未上色），仅可旋转查看，不参与任何报价计算。
 */
function StlViewer({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let dispose: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three');
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (disposed || !mountRef.current) return;
        const node = mountRef.current;
        const height = 480;
        const width = node.clientWidth || 480;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9); // 浅色背景
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        node.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(1, 1.2, 1); scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xffffff, 0.4); d2.position.set(-1, -0.5, -1); scene.add(d2);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        const loader = new STLLoader();
        loader.load(
          url,
          (geometry: any) => {
            if (disposed) { geometry.dispose(); return; }
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.65, metalness: 0.1 });
            const mesh = new THREE.Mesh(geometry, material);
            geometry.computeBoundingBox();
            const box = geometry.boundingBox!;
            const center = new THREE.Vector3();
            box.getCenter(center);
            mesh.position.sub(center); // 居中
            scene.add(mesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const dist = maxDim * 1.6 + 1;
            camera.position.set(dist, dist * 0.7, dist);
            camera.near = maxDim / 100;
            camera.far = maxDim * 100;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();
          },
          undefined,
          () => { if (!disposed) setFailed(true); }
        );

        let raf = 0;
        const animate = () => {
          raf = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const w = node.clientWidth || 480;
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
          renderer.setSize(w, height);
        };
        window.addEventListener('resize', onResize);

        dispose = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', onResize);
          controls.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => { disposed = true; dispose?.(); };
  }, [url]);

  if (failed) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        3D 模型加载失败。请用桌面版 Chrome / Edge 打开，并确认浏览器已启用 WebGL。
      </div>
    );
  }
  // 高度为 480px、宽度自适应、浅色背景；canvas 由 three 注入。
  return <div ref={mountRef} className="w-full rounded-lg overflow-hidden border border-slate-200" style={{ height: 480, background: '#f1f5f9' }} />;
}

/**
 * 业主 2026-11-13 最终定：inspect 的「价格」必须与 /quote/ 完全相等。
 * 做法：用本零件识别数据，复刻 /quote/（QuoteForm + QuoteWorkspace 映射）构造同一份 payload，
 * 调用同一后端 /api/v1/quote/calculate；压铸再叠加与 /quote/ 相同的前端覆盖(tryFrontendDieCasting)；
 * 板材默认走激光方案（与 /quote/ 默认 sheetPlan='laser' 一致），用 calculateLaserCuttingFee 算激光费。
 * 显示字段与 /quote/ 顶部一致：含税单价=unit_price_in_tax、材料费=material_cost、加工费=processing_cost、单件重量=weight_per_piece_kg。
 */

/** /quote/ 顶部展示的报价结果（与 QuoteWorkspace 取的字段一一对应） */
type InspectQuoteResult = {
  material_cost: number;
  processing_cost: number;
  surface_treatment_cost: number;
  unit_price: number;            // 含税单价（= unit_price_in_tax）
  unit_price_ex_tax: number;     // 未税单价
  weight_per_piece_kg: number;
  mold_cost?: number;
  notes?: string[];
};
/** 业主 2026-11-13 任务表第 3 条：把「已经选了」的表面处理透传给 /api/v1/quote/calculate。
 *  零件列表行的值本身就是后端 type（氧化本色/氧化上色/喷砂/拉丝/喷涂）；
 *  /quote/ 表单 chips 的值按 QuoteForm.mapSurfaceTreatment 同一张表映射。
 *  ⚠️ 不改任何单价、费率、系数、公式，只是把用户已选参数送给同一个后端接口。 */
const ST_DIRECT_TYPES = new Set([
  '氧化本色', '氧化上色', '喷砂', '拉丝', '喷涂', '喷涂/喷粉',
  '磷化', '镀锌/镀镍', '抛光/镀铬', '除油',
]);
const ST_CHIP_MAP: Record<string, string> = {
  '喷砂氧化': '喷砂', '抛光氧化': '抛光/镀铬', '拉丝氧化': '拉丝',
  '喷涂': '喷涂', '氧化': '氧化本色', '电镀': '镀锌/镀镍', '除油': '除油',
};
type SurfaceSelection = { type: string; label: string; color?: string | null } | null;

function normalizeSurfaceSelection(rawVal: unknown, colorVal: unknown): SurfaceSelection {
  const v = String(rawVal ?? '').trim();
  if (!v || v === '无' || v === 'none' || v === 'null' || v === 'undefined') return null;
  const color = colorVal ? String(colorVal).trim() : '';
  if (ST_DIRECT_TYPES.has(v)) return { type: v, label: v, color: color || null };
  let mapped = ST_CHIP_MAP[v];
  // 不认识的值宁可不传，也不能让后端走「默认估算(重量×2)」凭空加价
  if (!mapped) return null;
  if (v === '氧化' && color && color !== '本色') mapped = '氧化上色';
  return { type: mapped, label: v, color: color || null };
}

type InspectQuote = { ok: boolean; loading: boolean; result?: InspectQuoteResult; reason?: string };

const GRADE_ALIAS: Record<string, string> = {
  '6063': '6063', '6061': '6061', '5052': '5052', '6060': '6060',
  '铝（未指定）': '', '钢板': 'Q235', '钢': 'Q235',
  '冷轧板': 'SPCC', '不锈钢': '304',
};
// 板材材料类别归一化（与 QuoteForm.normalizeSheetCategory 完全一致，避免在 inspect 引整组件）
const SHEET_CATEGORY_RULES: Array<[string, string]> = [
  ['不锈钢', '不锈钢'], ['304', '不锈钢'], ['201', '不锈钢'], ['316', '不锈钢'], ['430', '不锈钢'],
  ['镀锌', '镀锌板'], ['白铁', '镀锌板'],
  ['冷轧', '冷轧板'], ['冷板', '冷轧板'], ['spcc', '冷轧板'],
  ['热轧', '钢板'],
  ['铝', '铝板'],
  ['钢', '钢板'], ['铁板', '钢板'], ['碳钢', '钢板'], ['q235', '钢板'], ['a3', '钢板'], ['锰钢', '钢板'],
];
function normalizeSheetCategory(raw: unknown, defaultCat = '铝板'): string {
  const s = String(raw ?? '').trim();
  if (!s) return defaultCat;
  const lower = s.toLowerCase();
  for (const [kw, cat] of SHEET_CATEGORY_RULES) {
    if (lower.includes(kw.toLowerCase())) return cat;
  }
  return defaultCat;
}

/** 从识别响应判定产品大类，复刻 QuoteWorkspace 第 132-208 行的映射逻辑 */
function classifyPart(raw: any): { productTypeZh: string; rawMat: string } {
  const part = raw && typeof raw === 'object' ? raw : {};
  const proc = String(part.process_type || part.product_type || '');
  const isSheetPart = part.is_sheet_metal === true || part.product_type === 'sheet_metal'
    || /sheet|板材|钣金/i.test(proc);
  const rawMat = part.material_grade || part.material || '';
  const notAluminum = /钢|铁|不锈钢|冷轧|镀锌|白铁|Q235|Q195|A3|SPCC|304|201|316|430/i.test(String(rawMat));
  const isCast = /die_cast|压铸|casting|锌合金|zinc/i.test(proc);
  const isExtrusion = !isSheetPart && !notAluminum && !isCast && (
    part.process_type === 'extrusion' || part.process_type === 'aluminum_extrusion'
    || part.die_type || part.perimeter || part.extrusion_length_mm || part.section_area_mm2
  );
  let productTypeZh: string;
  if (isCast) productTypeZh = /锌合金|zinc/i.test(String(rawMat)) ? '锌合金' : '压铸';
  else if (notAluminum && !isSheetPart) productTypeZh = '钢材';
  else if (isSheetPart || notAluminum) productTypeZh = '板材';
  else if (isExtrusion) productTypeZh = '挤出';
  else productTypeZh = '板材';
  return { productTypeZh, rawMat };
}

type BasicInfo = {
  name: string;
  code: string;
  productType: 'extrusion' | 'plate' | 'die_casting';
  processLabel: string;
  isSheet?: boolean;
  w?: number; h?: number; len?: number; thick?: number; area?: number;
  cd?: number; mw?: number; wg?: number; conf?: number | string;
  vol?: number; unfoldLen?: number; unfoldW?: number; bend?: number; hole?: number;
  isInjection?: boolean;
  mold: string;
  costTip: string;
};

function numFrom(r: any, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = r?.[k];
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

/**
 * 从后端识别响应里抽取「基本信息」（仅识别字段，价格改由后端 /api/v1/quote/calculate 计算，见下方 useEffect）。
 */
function buildBasicInfo(raw: any, fallbackFileName = ''): BasicInfo {
  const r0 = raw && typeof raw === 'object' ? raw : {};
  // 业主 2026-11-13 任务表 ②-⑤：专用识别响应把字段收在 data 层，_rawBackend 已摊平到顶层；
  // 这里再兜底一层（data 层优先并入顶层），保证 numFrom 总能读到几何量/体积。
  const r = (r0.data && typeof r0.data === 'object') ? { ...r0, ...r0.data } : r0;
  // 业主 2026-11-13 任务表第 2 条：产品名称 / 产品编号都要有，编号可以是文件名。
  // 专用识别接口往往只给 drawing_number 不给 product_name / product_code，
  // 因此名称按「产品名 → 零件名 → 图号 → 文件名」兜底，编号按「产品编号 → 图号 → 完整文件名」兜底。
  const fileNoExt = String(r.file_name || fallbackFileName || '').replace(/\.[^./\\]+$/, '');
  const fullFileName = String(r.file_name || fallbackFileName || '');
  const code = r.product_code || r.part_number || r.drawing_number || fullFileName || '';
  const name = r.product_name || r.part_name || r.drawing_number || fileNoExt || '';
  const isSheet = r.is_sheet_metal === true ? true : r.is_sheet_metal === false ? false : undefined;
  const procRaw = String(r.process_type || r.product_type || r._special_type || '');
  const isCast = /die_cast|压铸|casting/i.test(procRaw);
  const isInjection = /injection|注塑/i.test(procRaw) || r._special_type === 'injection';
  const isPlate = isSheet || /sheet|板材|钣金/i.test(procRaw);
  const productType: BasicInfo['productType'] = isPlate ? 'plate' : (isCast || isInjection) ? 'die_casting' : 'extrusion';
  const processLabel = isPlate ? '钣金 / 板材' : isCast ? '压铸' : isInjection ? '注塑' : '挤压型材';

  const w = numFrom(r, 'section_width_mm', 'width_mm', 'width');
  const h = numFrom(r, 'section_height_mm', 'height_mm', 'height');
  const len = numFrom(r, 'extrusion_length_mm', 'length_mm', 'length');
  const thick = numFrom(r, 'material_thickness_mm', 'wall_thickness_mm', 'thickness_mm', 'thickness');
  const area = numFrom(r, 'section_area_mm2', 'cross_section_area_mm2');
  const cd = numFrom(r, 'circumscribed_diameter_mm', 'section_min_circle_diameter_mm');
  const mw = numFrom(r, 'weight_kg_per_m', 'meter_weight');
  const wg = numFrom(r, 'weight_g', 'net_weight_g');
  const vol = numFrom(r, 'volume_mm3', 'volume_cm3');
  const unfoldLen = numFrom(r, 'unfold_length_mm', 'unfold_length', 'flat_length_mm');
  const unfoldW = numFrom(r, 'unfold_width_mm', 'unfold_width', 'flat_width_mm');
  const bend = numFrom(r, 'bend_count', 'bend_angle_deg');
  const hole = numFrom(r, 'punch_holes_total', 'unfold_hole_count', 'hole_count');
  const conf = r.confidence_score ?? r.confidence;
  const mold = r.mold_type || r.die_type || '';

  const costTip = (r.classification && r.classification.cost_tip) || '';
  return { name, code, productType, processLabel, isSheet, w, h, len, thick, area, cd, mw, wg, conf, vol, unfoldLen, unfoldW, bend, hole, isInjection, mold, costTip };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-800 break-words">{value}</dd>
    </div>
  );
}

function PriceBlock({ r }: { r: InspectQuoteResult }) {
  const weightStr = r.weight_per_piece_kg != null
    ? (r.weight_per_piece_kg >= 1
        ? `${r.weight_per_piece_kg.toFixed(3)} kg`
        : `${(r.weight_per_piece_kg * 1000).toFixed(1)} g`)
    : '—';
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-sm">
      <InfoRow label="含税单价" value={`¥${(r.unit_price ?? 0).toFixed(2)}`} />
      <InfoRow label="材料费" value={`¥${(r.material_cost ?? 0).toFixed(2)}`} />
      <InfoRow label="加工费" value={`¥${(r.processing_cost ?? 0).toFixed(2)}`} />
      <InfoRow label="表面处理费" value={r.surface_treatment_cost ? `¥${r.surface_treatment_cost.toFixed(2)}` : '无'} />
      <InfoRow label="单件重量" value={weightStr} />
      {r.mold_cost ? <InfoRow label="模具费" value={`¥${r.mold_cost.toFixed(2)}`} /> : null}
    </dl>
  );
}

export default function PartsInspectPage() {
  const { loading: authLoading, isAdmin } = useAuth();
  const [idx, setIdx] = useState(0);
  const [fileName, setFileName] = useState('');
  const [raw, setRaw] = useState<any>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [price, setPrice] = useState<InspectQuote>({ ok: false, loading: true });
  const [loaded, setLoaded] = useState(false);
  // 区分两种空态：①本会话压根没上传过图纸（ai_quote_parts / ai_quote_recog_result 皆空）；
  // ②上传过、后端也认，只是后端没给 drawing_preview_url 字段。
  const [hasSessionData, setHasSessionData] = useState(false);
  // 业主 2026-11-13 任务表第 3 条：用户在零件列表 / /quote/ 已经选过的表面处理。
  const [surfaceSel, setSurfaceSel] = useState<SurfaceSelection>(null);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const i = Math.max(0, Number(q.get('i') || 0) || 0);
      setIdx(i);
      if (q.get('raw') === '1') setShowRaw(true);
      const rawParts = localStorage.getItem('ai_quote_parts');
      const rawRecog = localStorage.getItem('ai_quote_recog_result');
      const payload = JSON.parse(rawParts || '{}');
      const p = Array.isArray(payload?.products) ? (payload.products[i] || null) : null;
      setFileName(String(payload?.fileName || p?._fileName || ''));
      let recog: any = {};
      try { recog = JSON.parse(rawRecog || '{}'); } catch { /* ignore */ }
      // 有任何一端有数据，即认为「本会话已上传过图纸」
      const has = !!(p || (Array.isArray(payload?.products) && payload.products.length) || (recog && Object.keys(recog).length));
      setHasSessionData(has);
      let backend = p?._rawBackend;
      if (!backend) backend = recog?.recogData || recog;
      setRaw(backend || p || {});

      // 「已选表面处理」按最近一次用户操作优先：零件列表本行 > /quote/ 表单草稿 > 预填零件 > 识别结果。
      // 零件列表页写入的是 p.surface_treatment（后端 type 口径），/quote/ 草稿写入的是 chips 口径。
      let draft: any = {};
      try {
        const d = JSON.parse(localStorage.getItem('ai_quote_form_draft_v1') || '{}');
        if (d && d.savedAt && Date.now() - d.savedAt <= 6 * 60 * 60 * 1000) draft = d;
      } catch { /* ignore */ }
      let selectedPart: any = {};
      try { selectedPart = JSON.parse(sessionStorage.getItem('ai_quote_selected_part') || '{}'); } catch { /* ignore */ }
      const candidates: Array<[unknown, unknown]> = [
        [p?.surface_treatment, p?.surface_color],
        [draft?.surfaceTreatment, draft?.surfaceColor],
        [selectedPart?.surface_treatment ?? selectedPart?.surfaceTreatment, selectedPart?.surface_color ?? selectedPart?.surfaceColor],
        [backend?.surface_treatment, backend?.surface_color],
        [recog?.recogData?.surface_treatment, recog?.recogData?.surface_color],
      ];
      for (const [v, c] of candidates) {
        const norm = normalizeSurfaceSelection(v, c);
        if (norm) { setSurfaceSel(norm); break; }
      }
      // 业主 2026-11-12 17:59 定：读后端响应顶层 drawing_preview_url，直接 <img src={值}>。
      // 主取原始响应顶层；其余为不同识别链路/包装层的兼容位。全为空或 null → 显示空态。
      const url = [
        backend?.drawing_preview_url,
        backend?.raw_parse?.stp?.drawing_preview_url,
        p?.drawing_preview_url,
        recog?.drawing_preview_url,
        recog?.recogData?.drawing_preview_url,
      ].find(v => typeof v === 'string' && v.trim() !== '');
      setPreviewUrl(url ? String(url).trim() : null);
      // 业主「前端任务_3D模型显示」：后端顶层多给 model_3d_url（data:model/stl;base64,...），
      // 与 drawing_preview_url 同一来源层级；有值则渲染可旋转的 STL，否则保持原 PNG。
      const m3d = [
        backend?.model_3d_url,
        backend?.raw_parse?.stp?.model_3d_url,
        p?.model_3d_url,
        recog?.model_3d_url,
        recog?.recogData?.model_3d_url,
      ].find(v => typeof v === 'string' && v.trim() !== '');
      setModelUrl(m3d ? String(m3d).trim() : null);
    } catch { /* 无数据则显示空态 */ }
    setLoaded(true);
  }, []);

  // 业主 2026-11-13 19:xx：STEP 文件若识别响应没带 3D（大文件常超时），这里按需补取。
  // 优先读识别页后台补好的结果缓存；否则用缓存的原始文件现取（自有 /api/parse-stp 的 55s 预算）。
  useEffect(() => {
    if (modelUrl) return;
    const name = String(fileName || '');
    if (!/\.stp$|\.step$/i.test(name)) return;
    let cancelled = false;
    (async () => {
      let cached: string | null = null;
      try { cached = sessionStorage.getItem(`ai_quote_step_3d::${name}`); } catch { /* ignore */ }
      if (cached) { if (!cancelled) setModelUrl(cached); return; }
      let raw: { b64: string; type: string } | null = null;
      try {
        const rawStr = sessionStorage.getItem(`ai_quote_step_raw::${name}`);
        if (rawStr) raw = JSON.parse(rawStr);
      } catch { /* ignore */ }
      if (!raw || !raw.b64) return; // 无缓存文件则保持静态图（不回归）
      try {
        setModelLoading(true);
        const bin = atob(raw.b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: raw.type || 'application/octet-stream' });
        const fd = new FormData();
        fd.append('file', blob, name);
        const r = await fetch('/api/parse-stp', { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) });
        if (!r.ok) return;
        const j = await r.json().catch(() => ({}));
        const u = typeof j.model_3d_url === 'string' && j.model_3d_url.trim() ? j.model_3d_url : null;
        if (!u || cancelled) return;
        setModelUrl(u);
        // 持久化回 localStorage 零件，刷新后仍保留 3D
        try {
          const rp = JSON.parse(localStorage.getItem('ai_quote_parts') || '{}');
          if (Array.isArray(rp.products) && rp.products[idx]) {
            rp.products[idx].model_3d_url = u;
            localStorage.setItem('ai_quote_parts', JSON.stringify(rp));
          }
        } catch { /* ignore */ }
        try { sessionStorage.setItem(`ai_quote_step_3d::${name}`, u); } catch { /* ignore */ }
      } catch { /* 失败保持静态图 */ }
      finally { if (!cancelled) setModelLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [modelUrl, fileName, idx]);

  const drawings = useMemo(() => findDrawingSources(raw), [raw]);
  const summary = useMemo(() => makePlainSummary(raw), [raw]);
  const entries = useMemo(() => {
    const o = raw && typeof raw === 'object' ? raw : {};
    return Object.entries(o as Record<string, unknown>)
      .filter(([k]) => k !== '_rawBackend')
      .map(([k, v]) => ({ key: k, label: FIELD_LABELS[k] || k, value: formatValue(v), long: typeof v === 'object' && v !== null }));
  }, [raw]);

  // 普通用户看到的「基本信息」卡片（识别字段），见 buildBasicInfo。
  const basicInfo = useMemo(() => buildBasicInfo(raw, fileName), [raw, fileName]);

  // 业主 2026-11-13 最终定：价格必须与 /quote/ 完全相等。
  // 用本零件识别数据，复刻 /quote/（QuoteForm + QuoteWorkspace 映射）构造同一份 payload，
  // 调同一后端 /api/v1/quote/calculate；压铸叠加与 /quote/ 相同的前端覆盖；板材默认走激光方案。
  useEffect(() => {
    let cancelled = false;
    const part = raw && typeof raw === 'object' ? raw : {};
    const { productTypeZh, rawMat } = classifyPart(part);

    const buildPayload = (): Record<string, any> | null => {
      if (productTypeZh === '挤出' || productTypeZh === '钢材') {
        const area = numFrom(part, 'section_area_mm2', 'cross_section_area_mm2');
        const len = numFrom(part, 'extrusion_length_mm', 'length_mm', 'length');
        const w = numFrom(part, 'section_width_mm', 'width_mm', 'width');
        const h = numFrom(part, 'section_height_mm', 'height_mm', 'height');
        const mw = numFrom(part, 'weight_kg_per_m', 'meter_weight');
        const t = numFrom(part, 'wall_thickness_mm', 'material_thickness_mm', 'thickness_mm', 'thickness');
        const per = numFrom(part, 'perimeter_mm', 'outer_perimeter_mm', 'perimeter');
        if (productTypeZh === '钢材') {
          if (!((mw && mw > 0) || (area && area > 0))) return null;
        } else {
          if (!((area && area > 0) || (mw && mw > 0))) return null;
          if (!(len && len > 0)) return null;
        }
        const grade = (rawMat in GRADE_ALIAS) ? GRADE_ALIAS[rawMat] : rawMat;
        const payload: Record<string, any> = {
          product_type: productTypeZh === '钢材' ? 'steel_standard' : 'extrusion',
          material: productTypeZh === '钢材' ? { category: '钢材', grade: grade || 'Q235' } : { category: '挤压铝型材', grade: grade || undefined },
          quantity: 1,
          dimensions: {
            standard_category: '异型材',
            length_mm: len || 0, width_mm: w || 0, height_mm: h || undefined,
            cross_section_area_mm2: area || undefined, meter_weight_kg_per_m: mw || undefined,
            wall_thickness_mm: t || undefined, perimeter_mm: per || undefined,
          },
        };
        return payload;
      }
      if (productTypeZh === '板材') {
        const bL = numFrom(part, 'unfold_length_mm', 'unfold_length', 'sheet_length', 'length_mm', 'length');
        const bW = numFrom(part, 'unfold_width_mm', 'unfold_width', 'sheet_width', 'width_mm', 'width');
        const t = numFrom(part, 'material_thickness_mm', 'wall_thickness_mm', 'thickness_mm', 'thickness');
        if (!(bL && bL > 0) || !(bW && bW > 0)) return null;
        const cat = normalizeSheetCategory(rawMat);
        const grade = cat === '不锈钢' ? '304' : '5052';
        const payload: Record<string, any> = {
          product_type: 'sheet_metal',
          material: { category: cat, grade },
          quantity: 1,
          dimensions: { length_mm: bL, width_mm: bW, wall_thickness_mm: t || undefined },
        };
        // 默认激光方案（与 /quote/ 默认 sheetPlan='laser' 一致）
        const cutPath = numFrom(part, 'cut_total_path_mm', 'cut_perimeter_mm', 'cut_total_length');
        const holeCount = numFrom(part, 'unfold_hole_count', 'punch_holes_total', 'cnc_total_holes', 'all_holes_total') || 0;
        if (t && cutPath && cutPath > 0) {
          const lr = calculateLaserCuttingFee({ thickness: t, cutTotalPath: cutPath, holeCount });
          if (lr && !lr.unavailable) {
            payload.laser_cutting_fee = lr.totalLaserFee;
            payload.laser_cutting_detail = {
              cutting_fee: lr.cuttingFee, piercing_fee: lr.piercingFee,
              unit_price: lr.unitPrice, pierce_rate: lr.pierceRate,
            };
          }
        }
        return payload;
      }
      if (productTypeZh === '压铸' || productTypeZh === '锌合金') {
        const wg = part.weight_g != null ? Number(part.weight_g) / 1000
                 : (part.weight_kg_per_m != null ? Number(part.weight_kg_per_m) : undefined);
        const cv = numFrom(part, 'volume_cm3', 'volume_mm3');
        if (!(wg && wg > 0)) return null;
        const payload: Record<string, any> = {
          product_type: productTypeZh === '锌合金' ? 'zinc_alloy' : 'die_casting',
          material: { category: productTypeZh === '锌合金' ? '锌合金ZA-8' : '压铸铝ADC12', grade: GRADE_ALIAS[rawMat] || rawMat || 'ADC12' },
          quantity: 1, weight_per_piece_kg: wg,
        };
        if (cv && cv > 0) payload.volume_cm3 = cv;
        return payload;
      }
      if (productTypeZh === '注塑') {
        const cL = numFrom(part, 'length_mm', 'length');
        const cW = numFrom(part, 'width_mm', 'width');
        const cH = numFrom(part, 'height_mm', 'height');
        const cv = numFrom(part, 'volume_cm3', 'volume_mm3');
        if (!(cL && cW)) return null;
        return {
          product_type: 'injection', material: { category: '塑料', grade: '' }, quantity: 1,
          dimensions: { length_mm: cL, width_mm: cW, height_mm: cH || undefined, volume_cm3: cv || undefined },
        };
      }
      return null;
    };

    const payload = buildPayload();
    if (!payload) {
      if (!cancelled) setPrice({ ok: false, loading: false, reason: '缺少必要尺寸（截面/展开尺寸或单件重量）' });
      return;
    }
    // 业主 2026-11-13 任务表第 3 条：把已选表面处理透传给同一个后端报价接口。
    // 与 /quote/ 的 payload 字段完全一致（surface_treatment: { type, color }），
    // 费率/系数/公式一律由后端既有规则计算，前端不参与、不改动。
    if (surfaceSel) {
      payload.surface_treatment = { type: surfaceSel.type, color: surfaceSel.color || null };
    }
    // 钢材标准件路由不支持、/quote/ 走前端计；此处降级提示
    if (payload.product_type === 'steel_standard') {
      if (!cancelled) setPrice({ ok: false, loading: false, reason: '钢材标准件请到 /quote/ 获取精确报价' });
      return;
    }

    setPrice({ ok: false, loading: true });
    fetch('/api/v1/quote/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data: any) => {
        if (cancelled) return;
        if (data?.success) {
          let result: any = data;
          if (payload.product_type === 'die_casting') {
            const fe = tryFrontendDieCasting(data, payload);
            if (fe) result = fe;
          }
          setPrice({
            ok: true, loading: false,
            result: {
              material_cost: result.material_cost || 0,
              processing_cost: result.processing_cost || 0,
              surface_treatment_cost: result.surface_treatment_cost || 0,
              unit_price: result.unit_price_in_tax || result.unit_price || 0,
              unit_price_ex_tax: result.unit_price_ex_tax || result.unit_price || 0,
              weight_per_piece_kg: result.weight_per_piece_kg || 0,
              mold_cost: result.mold_cost || 0,
              notes: result.notes || [],
            },
          });
        } else {
          setPrice({ ok: false, loading: false, reason: data?.error || '后端报价计算失败' });
        }
      })
      .catch(() => { if (!cancelled) setPrice({ ok: false, loading: false, reason: '网络错误，无法连接报价服务' }); });
    return () => { cancelled = true; };
  }, [raw, surfaceSel]);

  return (
  <QuoteSidebarLayout fromPartsList partsListLabel={fileName}>
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/quote/parts" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={16} /> 返回零件列表
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-semibold">图纸与后端信息</h1>
          <span className="ml-auto text-xs text-slate-400">零件 #{idx + 1}{fileName ? ` · ${fileName}` : ''}</span>
        </div>

        {/* ① + ①-2 二选一（业主 2026-11-13 定）：STEP 等有 model_3d_url → 只显示 3D、隐藏图片；
            图片/PDF 等无 3D → 只显示静态图纸、隐藏 3D 区块。 */}
        {!loaded ? (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
            <div className="text-sm text-slate-400 py-8 text-center">读取中…</div>
          </section>
        ) : null}
        {/* ① 后端给出的图纸（无 3D 时显示） */}
        {loaded && !modelUrl && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <FileImage size={18} className="text-blue-600" />
            <h2 className="font-medium">后端给出的图纸</h2>
            {previewUrl ? (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-mono">drawing_preview_url</span>
            ) : drawings.length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">兜底探测 {drawings.length} 张</span>
            ) : null}
          </div>
          {!loaded ? (
            <div className="text-sm text-slate-400 py-8 text-center">读取中…</div>
          ) : previewUrl ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs text-slate-500 flex-1 font-mono">drawing_preview_url</span>
                <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                  新窗口打开 <ExternalLink size={12} />
                </a>
              </div>
              {/* 业主 2026-11-12 定：读顶层 drawing_preview_url，直接 <img src={值}> */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="后端给出的图纸" className="w-full max-h-[640px] object-contain bg-white" />
            </div>
          ) : drawings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Info size={22} className="mx-auto mb-2 text-slate-400" />
              {!hasSessionData ? (
                <>
                  <div className="text-sm font-medium text-slate-600 mb-1">本会话还没有上传过图纸</div>
                  <div className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto">
                    零件列表的「图纸」数据来自浏览器本地存储（localStorage）。请先到
                    <code className="px-1 py-0.5 rounded bg-slate-200 font-mono">/quote/extrusion</code>
                    或 <code className="px-1 py-0.5 rounded bg-slate-200 font-mono">/quote/recognize</code>
                    （图纸 AI 识别）上传文件，等识别完成后进入零件列表，再点「图纸」按钮。
                    直接手敲本页地址而没先上传，就会看到这个空态。
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-slate-600 mb-1">后端暂未返回图纸</div>
                  <div className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto">
                    后端响应顶层的 <code className="px-1 py-0.5 rounded bg-slate-200 font-mono">drawing_preview_url</code> 为空（null）。
                    后端补上该字段后本页会直接把它的值放进图片地址显示，无需再改前端；
                    字段值可以是图片 URL 或 base64 图片。
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drawings.map((d, i) => (
                <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs text-slate-500 truncate flex-1" title={d.label}>{d.label}</span>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                      新窗口打开 <ExternalLink size={12} />
                    </a>
                  </div>
                  {d.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.url} alt={`后端图纸 ${i + 1}`} className="w-full max-h-[520px] object-contain bg-white" />
                  ) : d.kind === 'pdf' ? (
                    <iframe src={d.url} title={`后端图纸 ${i + 1}`} className="w-full h-[480px]" />
                  ) : (
                    <div className="p-4 text-xs break-all text-slate-500">{d.url}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* ①-2 后端给出的 3D 模型（有 model_3d_url 时显示，否则隐藏） */}
        {loaded && !modelUrl && modelLoading && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Box size={18} className="text-blue-600" />
              <h2 className="font-medium">3D 模型（可旋转）</h2>
            </div>
            <div className="text-sm text-slate-400 py-8 text-center">正在加载 3D 模型…（大文件解析较慢，请稍候）</div>
          </section>
        )}
        {loaded && modelUrl && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Box size={18} className="text-blue-600" />
            <h2 className="font-medium">3D 模型（可旋转）</h2>
            {modelUrl ? (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-mono">model_3d_url</span>
            ) : null}
          </div>
          <StlViewer url={modelUrl} />
        </section>
        )}

        {/* ② 后端全部信息（管理员专属，保持原样）/ 基本信息（普通用户） */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          {authLoading ? (
            <div className="text-sm text-slate-400 py-4">检查权限中…</div>
          ) : isAdmin ? (
            <>
              <div className="flex items-start gap-2 mb-2">
                <ShieldAlert size={18} className="text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h2 className="font-medium">后端给出的全部信息</h2>
                  <p className="text-xs text-slate-500 mt-0.5">把后端原始返回翻译成通俗语言，供管理员测试核对。普通用户不可见。</p>
                </div>
              </div>
              <a
                href={`/quote/parts/inspect?i=${idx}&raw=1`}
                onClick={(e) => { e.preventDefault(); setShowRaw(v => !v); }}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
              >
                <ChevronDown size={14} className={`transition-transform ${showRaw ? 'rotate-180' : ''}`} />
                {showRaw ? '收起后端全部信息' : '查看后端给出的全部信息（通俗解释）'}
              </a>
              {showRaw && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                    <div className="text-sm font-medium text-blue-900 mb-2">一句话看懂</div>
                    <ul className="space-y-1">
                      {summary.map((s, i) => <li key={i} className="text-sm text-blue-900 leading-relaxed">· {s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">字段对照表（{entries.length} 项）</div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs">
                          <tr><th className="text-left px-3 py-2 w-1/4">含义</th><th className="text-left px-3 py-2 w-1/3">后端字段</th><th className="text-left px-3 py-2">值</th></tr>
                        </thead>
                        <tbody>
                          {entries.map(e => (
                            <tr key={e.key} className="border-t border-slate-100">
                              <td className="px-3 py-1.5 text-slate-700">{e.label}</td>
                              <td className="px-3 py-1.5 text-slate-400 font-mono text-xs break-all">{e.key}</td>
                              <td className={`px-3 py-1.5 break-all ${e.long ? 'text-slate-500 text-xs' : 'text-slate-800'}`}>{e.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <button onClick={() => setShowJson(v => !v)} className="text-sm text-blue-600 hover:underline">
                      {showJson ? '收起' : '展开'}原始 JSON（未经翻译）
                    </button>
                    {showJson && (
                      <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 text-slate-100 text-xs p-4 whitespace-pre-wrap break-all">
                        {JSON.stringify(raw, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 mb-3">
                <Info size={18} className="text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h2 className="font-medium">基本信息</h2>
                  <p className="text-xs text-slate-500 mt-0.5">零件识别结果的关键信息与价格预估。</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-medium mb-2">识别信息</div>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
                    {/* 业主 2026-11-13 任务表 ②-⑤：图纸信息按料型显示，各料型只显示自己该有的 */}
                    <InfoRow label="产品名称" value={basicInfo.name || '—'} />
                    <InfoRow label="产品编号" value={basicInfo.code || '—'} />
                    <InfoRow label="工艺类型" value={basicInfo.processLabel} />
                    {/* 板材 / 钣金：展开尺寸 */}
                    {basicInfo.productType === 'plate' && (
                      <>
                        <InfoRow label="展开长" value={basicInfo.unfoldLen != null ? `${basicInfo.unfoldLen} mm` : '—'} />
                        <InfoRow label="展开宽" value={basicInfo.unfoldW != null ? `${basicInfo.unfoldW} mm` : '—'} />
                        <InfoRow label="板厚" value={basicInfo.thick != null ? `${basicInfo.thick} mm` : '—'} />
                        <InfoRow label="折弯数" value={basicInfo.bend != null ? `${basicInfo.bend}` : '—'} />
                        <InfoRow label="孔数" value={basicInfo.hole != null ? `${basicInfo.hole} 个` : '—'} />
                        <InfoRow label="单件重" value={basicInfo.wg != null ? `${basicInfo.wg >= 1000 ? (basicInfo.wg / 1000).toFixed(3) + ' kg' : basicInfo.wg.toFixed(1) + ' g'}` : '—'} />
                      </>
                    )}
                    {/* 铸造 / 注塑：体积 + 净重 */}
                    {basicInfo.productType === 'die_casting' && (
                      <>
                        <InfoRow label="体积" value={basicInfo.vol != null ? `${basicInfo.vol} mm³` : '—'} />
                        <InfoRow label="净重" value={basicInfo.wg != null ? `${basicInfo.wg >= 1000 ? (basicInfo.wg / 1000).toFixed(3) + ' kg' : basicInfo.wg.toFixed(1) + ' g'}` : '—'} />
                        <InfoRow label="宽" value={basicInfo.w != null ? `${basicInfo.w} mm` : '—'} />
                        <InfoRow label="高" value={basicInfo.h != null ? `${basicInfo.h} mm` : '—'} />
                        <InfoRow label="长" value={basicInfo.len != null ? `${basicInfo.len} mm` : '—'} />
                      </>
                    )}
                    {/* 挤出 / 钢材：截面 + 米重 */}
                    {basicInfo.productType === 'extrusion' && (
                      <>
                        <InfoRow label="截面尺寸" value={(basicInfo.w != null || basicInfo.h != null) ? `宽 ${basicInfo.w ?? '—'} × 高 ${basicInfo.h ?? '—'} mm` : '—'} />
                        <InfoRow label="型材长度" value={basicInfo.len != null ? `${basicInfo.len} mm` : '—'} />
                        <InfoRow label="截面积" value={basicInfo.area != null ? `${basicInfo.area} mm²` : '—'} />
                        <InfoRow label="每米重" value={basicInfo.mw != null ? `${basicInfo.mw} kg/m` : '—'} />
                        <InfoRow label="外接圆直径" value={basicInfo.cd != null ? `${basicInfo.cd} mm` : '—'} />
                        <InfoRow label="建议模具类型" value={basicInfo.mold || '—'} />
                      </>
                    )}
                  </dl>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium">价格</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                      与 /quote/ 同口径 · 1 件 · {surfaceSel ? `表面处理：${surfaceSel.label}` : '无表面处理'}
                    </span>
                  </div>
                  {price.loading ? (
                    <div className="text-sm text-slate-400 py-2">正在向报价服务计算…</div>
                  ) : price.ok && price.result ? (
                    <PriceBlock r={price.result} />
                  ) : (
                    <div className="text-sm text-slate-500">暂无法估算：{price.reason}。</div>
                  )}
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    注：以上数字与 /quote/ 完全一致——由同一后端报价接口（/api/v1/quote/calculate）按本零件识别尺寸 + 站点实时价计算，
                    数量 1 件，表面处理沿用您在零件列表 / /quote/ 的选择{surfaceSel ? `（${surfaceSel.label}）` : '（当前未选）'}。
                    如需改长度 / 数量 / 表面处理 / 牌号等实际参数，请点下方「去 /quote/ 获取正式报价」。
                  </p>
                </div>
                {basicInfo.costTip ? (
                  <div>
                    <div className="text-sm font-medium mb-1">后端成本提示</div>
                    <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">{basicInfo.costTip}</p>
                  </div>
                ) : null}
                <div className="pt-3 border-t border-slate-100">
                  <a
                    href="/quote?from=parts"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink size={16} />
                    去 /quote/ 获取正式报价（按实际长度 / 数量 / 表面处理）
                  </a>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    上方「价格」即按本零件识别尺寸、由同一后端接口算出的结果；点这里进入 /quote/ 可调真实参数并出正式报价单。
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <p className="text-xs text-slate-400 mt-4 text-center">
          数据来源：本次图纸识别的后端原始响应（保存在当前浏览器会话中）
        </p>
      </div>
    </div>
  </QuoteSidebarLayout>
  );
}
