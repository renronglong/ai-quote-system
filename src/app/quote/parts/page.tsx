"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Layers, CheckCircle2, Upload, Pencil,
  ChevronRight, ArrowRight, Package, Ruler, Box, Info, AlertCircle, Loader2, X, Zap
} from 'lucide-react';
import TopNavLinks from '@/components/TopNav';
import { useAuth } from '@/lib/auth-context';
import { saveQuoteToAPI } from '@/components/SavedQuotesPanel';
import { normalizeSheetCategory, PRODUCT_TYPES, CASTING_GRADES } from '@/components/QuoteForm';
import { calculateStampingMoldFee, calculateLaserCuttingFee } from '@/lib/stamping-mold-calculator';

interface PartData {
  _partName?: string;
  _fileName?: string;
  _quantity?: number;
  _isSheet?: boolean;
  _failed?: boolean;
  _error?: string;
  product_type?: string;
  process_type?: string;
  is_sheet_metal?: boolean;
  area_method?: string;
  product_code?: string;
  product_name?: string;
  part_name?: string;
  part_number?: string;
  quantity?: number;
  material_grade?: string;
  surface_treatment?: string;
  // 挤型参数
  width?: number;
  height?: number;
  length?: number;
  wall_thickness?: number;
  perimeter?: number;
  meter_weight?: number;
  crossSectionArea?: number;
  die_type?: string;
  // 钣金参数
  thickness_mm?: number;
  unfold_length_mm?: number;
  unfold_width_mm?: number;
  unfold_area_mm2?: number;
  cut_perimeter_mm?: number;
  bend_count?: number;
  punch_holes_total?: number;
  cnc_total_holes?: number;
  weight_g?: number;
  [key: string]: any;
}

interface PartsPayload {
  products: PartData[];
  isAssembly: boolean;
  fileName: string;
  originalFile?: any;
  recognitionId?: string;
  createdAt: number;
}

// ==================== 批量生成报价：参数构造 ====================
// 把识别结果直接喂给 /api/v1/quote/calculate（用默认/AI预填值，无需逐一点击确认）。
// product_type 映射：钣金折弯 → sheet_metal；挤压型材 → extrusion；其余按 product_type/process_type 兜底。
type ApiType = 'sheet_metal' | 'extrusion' | 'die_casting' | 'zinc_alloy' | 'injection';
interface BuiltPayload {
  apiType: ApiType;
  productTypeZh: string;
  category: string;
  payload: Record<string, any>;
  params: Record<string, any>;
  skipReason?: string;
}

function isSheetPart(p: PartData): boolean {
  return !!(
    p.is_sheet_metal === true || p._isSheet ||
    p.area_method === 'sheet_metal' || p.process_type === 'sheet_metal' ||
    p.product_type === 'sheet_metal'
  );
}

function resolveApiType(p: PartData): { apiType: ApiType | null; zh: string } {
  if (isSheetPart(p)) return { apiType: 'sheet_metal', zh: '板材' };
  const t = String(p.product_type || p.process_type || '').toLowerCase();
  if (t.includes('extrusion') || t === '挤出') return { apiType: 'extrusion', zh: '挤出' };
  if (t.includes('die_cast') || t === '压铸') return { apiType: 'die_casting', zh: '压铸' };
  if (t.includes('zinc') || t === '锌') return { apiType: 'zinc_alloy', zh: '锌合金' };
  if (t.includes('inject') || t === '注塑') return { apiType: 'injection', zh: '注塑' };
  if (p.die_type || p.perimeter) return { apiType: 'extrusion', zh: '挤出' };
  return { apiType: null, zh: '' };
}

function partNameOf(p: PartData, idx: number): string {
  return p.part_number || p._partName || p.product_code || p.product_name || p.part_name || `零件${idx + 1}`;
}

// 板材加工方案（业主 2026-11-02：批量生成前三选一——开模/现模/激光切割）
type SheetPlan = 'open_mold' | 'existing_mold' | 'laser';

function buildPartPayload(p: PartData, idx: number, sheetPlan?: SheetPlan): BuiltPayload {
  const { apiType, zh } = resolveApiType(p);
  if (!apiType) {
    return { apiType: 'sheet_metal', productTypeZh: '', category: '', payload: {}, params: {}, skipReason: '无法判定产品类型' };
  }

  const partName = partNameOf(p, idx);
  const grade = p.material_grade || '';
  // 挤出件的 material_grade 常被识别写成类别词（异型材/标准件/铝圆棒等），不是牌号；
  // 过滤掉类别词，报价单材质列回落 6063-T5 缺省（业主 2026-11-02）
  const CATEGORY_WORDS = new Set(['异型材', '标准件', '铝型材', '铝合金', '型材', '挤出', '挤出铝型材', '挤压铝型材', '铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管']);
  const realGrade = CATEGORY_WORDS.has(grade.trim()) ? '' : grade;
  // 板材用 normalizeSheetCategory 归一化到合法类目；型材类后端按铝计价（已知限制：钢型材仍按铝），
  // 其余按类型给默认类目（识别未给材料时兜底）。
  let category = '';
  if (apiType === 'sheet_metal') category = normalizeSheetCategory(grade || '铝板');
  else if (apiType === 'extrusion') category = grade || '铝型材';
  else if (apiType === 'die_casting') category = grade || '压铸铝ADC12';
  else if (apiType === 'zinc_alloy') category = grade || '锌合金ZA-8';
  else if (apiType === 'injection') category = grade || 'ABS';

  const qty = Number(p.quantity || p._quantity || 1) || 1;

  const payload: Record<string, any> = {
    product_type: apiType,
    material: { category, grade: realGrade || undefined },
    quantity: qty,
    product_name: partName,
  };
  if (p.product_code || p.product_number) payload.product_code = p.product_code || p.product_number;

  let dims: Record<string, any> | null = null;
  if (apiType === 'sheet_metal') {
    const l = Number(p.unfold_length_mm ?? p.length);
    const w = Number(p.unfold_width_mm ?? p.width);
    const t = Number(p.thickness_mm ?? p.wall_thickness);
    if (!(l > 0) || !(w > 0)) {
      return { apiType, productTypeZh: zh, category, payload: {}, params: {}, skipReason: '板材缺少长宽尺寸' };
    }
    dims = { length_mm: l, width_mm: w, wall_thickness_mm: t > 0 ? t : undefined };
  } else if (apiType === 'extrusion') {
    dims = {
      width_mm: Number(p.width) || 0,
      height_mm: Number(p.height) || undefined,
      length_mm: Number(p.length) || 0,
      wall_thickness_mm: Number(p.wall_thickness) > 0 ? Number(p.wall_thickness) : undefined,
      cross_section_area_mm2: Number(p.crossSectionArea || p.section_area_mm2) || undefined,
      perimeter_mm: Number(p.perimeter) || undefined,
      meter_weight_kg_per_m: Number(p.meter_weight) || undefined,
    };
  }
  if (dims) payload.dimensions = dims;
  if (p.surface_treatment) payload.surface_treatment = { type: p.surface_treatment };
  const wKg = Number(p.weight_g) > 0 ? Number(p.weight_g) / 1000 : undefined;
  if (wKg) payload.weight_per_piece_kg = wKg;

  const params: Record<string, any> = {
    product_type: apiType,
    productName: partName,
    materialCategory: category,
    materialGrade: realGrade,
    material: { category, grade: realGrade || undefined },
    quantity: qty,
    dimensions: dims || undefined,
  };
  if (p.product_code || p.product_number) params.productCode = p.product_code || p.product_number;

  // 板材加工方案：按所选方案补充模具费/激光切割费（业主 2026-11-02）
  if (apiType === 'sheet_metal' && sheetPlan) {
    params.sheet_process_plan = sheetPlan;
    const T = Number(p.thickness_mm ?? p.wall_thickness) || 0;  // 板厚回退 wall_thickness：识别数据常存这里，T=0 会静默丢冲压模具费/激光费
    const Lm = Number(p.unfold_length_mm ?? p.length) || 0;
    const Wm = Number(p.unfold_width_mm ?? p.width) || 0;
    const holeCount = Number(p.punch_holes_total ?? p.cnc_total_holes ?? 0) || 0;
    if (sheetPlan === 'laser') {
      // 方案B：激光切割（不开模）——切割费+穿孔费计入单价
      const cutPath = Number(p.cut_perimeter_mm) || (Lm > 0 && Wm > 0 ? 2 * (Lm + Wm) : 0);
      const lr = T > 0 && cutPath > 0 ? calculateLaserCuttingFee({ thickness: T, cutTotalPath: cutPath, holeCount }) : null;
      if (lr && !lr.unavailable) {
        payload.laser_cutting_fee = lr.totalLaserFee;
        payload.laser_cutting_detail = {
          cutting_fee: lr.cuttingFee,
          piercing_fee: lr.piercingFee,
          unit_price: lr.unitPrice,
          pierce_rate: lr.pierceRate,
        };
      }
    } else if (sheetPlan === 'open_mold') {
      // 方案A：开新冲压模，模具费单独列出（不计入单价）
      const outerPerimeter = Lm > 0 && Wm > 0 ? 2 * (Lm + Wm) : 0;
      const holesPerimeter = Math.max(0, (Number(p.cut_perimeter_mm) || 0) - outerPerimeter);
      const sr = Lm > 0 && Wm > 0 && T > 0
        ? calculateStampingMoldFee({ unfoldLength: Lm, unfoldWidth: Wm, thickness: T, outerPerimeter, holesPerimeter, holeCount })
        : null;
      if (sr && !sr.isNonStandard) {
        payload.mold_cost = sr.totalMoldFee;
        payload.mold_spec = `冲压复合模 ${sr.frameSize[0]}×${sr.frameSize[1]}`;
      }
    } else if (sheetPlan === 'existing_mold') {
      // 现有模具：免开模费（模具费0）
      payload.use_existing_mold = true;
    }
  }

  return { apiType, productTypeZh: zh, category, payload, params };
}

export default function QuotePartsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [payload, setPayload] = useState<PartsPayload | null>(null);
  const [quotedParts, setQuotedParts] = useState<Set<number>>(new Set());
  // ⚠️ 选项 = 首页五大产品项下「所有材料类目」的并集（业主 2026-10-14：全部关联）：
  //   挤出铝型材：异型材/标准件；板材：铝板/冷轧板/钢板/不锈钢/镀锌板；
  //   铸造：铝合金/锌合金；注塑：ABS/PP/PC/PA/POM/PMMA；钢材：钢材标准件
  //   与报价页材料完全同源（遍历 PRODUCT_TYPES），首页改这里自动跟。
  // 按首页五大产品项分组 + 子件钻取（业主 2026-10-14：与首页层级完全一致）
  // 层级：产品大类（挤出铝型材/板材/铸造/注塑/钢材） → 材料类别 → 子件（种类/牌号）；无子件的类目点击即选
  const SHEET_AL_GRADES = [
    { label: '1060 纯铝', value: '1060' },
    { label: '3003 防锈', value: '3003' },
    { label: '5052 镁铝', value: '5052' },
    { label: '5083 海洋级', value: '5083' },
    { label: '7075 航空铝', value: '7075' },
  ];
  const MATERIAL_CHILDREN: Record<string, Record<string, { label: string; value: string }[]>> = {
    '挤出': {
      '标准件': ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管'].map(k => ({ label: k, value: k })),
    },
    '板材': { '铝板': SHEET_AL_GRADES },
    '压铸': {
      '铝': (CASTING_GRADES['铝'] || []).map(x => ({ label: x.label, value: x.g })),
      '锌合金': (CASTING_GRADES['锌合金'] || []).map(x => ({ label: x.label, value: x.g })),
    },
    '钢材': {
      '钢标准件': ['圆钢', '方钢', '六角钢', '角钢', '圆钢管', '方管', '槽钢', '工字钢'].map(k => ({ label: k, value: k })),
    },
  };
  // 子牌号（业主 2026-11-02）：异型材 / 标准件（含钢材·钢标准件）需再选一层牌号；挤压材料费不读牌号，纯展示口径
  const GRADE_OPTIONS: Record<string, { label: string; value: string }[]> = {
    '挤出-异型材': ['6063-T5', '6063-T6', '6061-T6', '6060-T5', '6082-T6', '6005A-T5'].map(v => ({ label: v, value: v })),
    '挤出-标准件': ['6063-T5', '6063-T6', '6061-T6', '6060-T5', '6082-T6', '6005A-T5'].map(v => ({ label: v, value: v })),
    '钢材-钢标准件': ['Q235', '45#', '40Cr', '304', '316'].map(v => ({ label: v, value: v })),
  };
  // 表面处理选填（默认无）：值与后端 applySurfaceCost switch 对齐（氧化本色/氧化上色/喷砂/拉丝/喷涂）
  const SURFACE_OPTIONS = ['无', '氧化本色', '氧化上色', '喷砂', '拉丝', '喷涂'];
  const MATERIAL_GROUPS: { ptKey: string; ptLabel: string; cats: { key: string; label: string; children?: { label: string; value: string }[] }[] }[] = (() => {
    const groups: { ptKey: string; ptLabel: string; cats: { key: string; label: string; children?: { label: string; value: string }[] }[] }[] = [];
    for (const [ptKey, cfg] of Object.entries(PRODUCT_TYPES)) {
      const cats = Object.entries(cfg.materialCategories ?? {})
        .filter(([, c]) => !!c.label)
        .map(([key, c]) => ({ key, label: c.label, children: MATERIAL_CHILDREN[ptKey]?.[key] }));
      if (cats.length) groups.push({ ptKey, ptLabel: cfg.label, cats });
    }
    return groups;
  })();
  const [materialModalIdx, setMaterialModalIdx] = useState<number | null>(null); // 哪个零件弹出选材料
  const [materialModalCat, setMaterialModalCat] = useState<{ ptKey: string; ptLabel: string; key: string; label: string; children: { label: string; value: string }[] } | null>(null); // 已钻取到的材料类别
  const [materialModalChild, setMaterialModalChild] = useState<{ label: string; value: string } | null>(null); // 已钻取到的形状子件（进牌号层前暂存）
  // 批量生成报价相关状态
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, success: 0, skipped: 0 });
  const [batchDone, setBatchDone] = useState(false);
  const [batchSummary, setBatchSummary] = useState('');
  const [batchError, setBatchError] = useState('');
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  // 批量板材加工方案（默认激光切割）
  // 板材加工方案持久到 sessionStorage：页面刷新/补选材料往返后不再静默回落默认激光（业主 2026-11-02）
  const [batchSheetPlan, setBatchSheetPlan] = useState<SheetPlan>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = sessionStorage.getItem('ai_quote_sheet_plan');
        if (v === 'open_mold' || v === 'existing_mold' || v === 'laser') return v as SheetPlan;
      } catch { /* ignore */ }
    }
    return 'laser';
  });
  const updateBatchSheetPlan = (v: SheetPlan) => {
    setBatchSheetPlan(v);
    try { sessionStorage.setItem('ai_quote_sheet_plan', v); } catch { /* ignore */ }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_quote_parts');
      if (!raw) { router.push('/quote/recognize'); return; }
      const data: PartsPayload = JSON.parse(raw);
      setPayload(data);
      // 恢复批量生成已保存的零件标记（刷新后仍保持绿色✓）
      try {
        const bq = sessionStorage.getItem('ai_quote_batch_quoted');
        if (bq) {
          const arr = JSON.parse(bq) as number[];
          if (Array.isArray(arr) && arr.length) {
            setQuotedParts(prev => new Set([...prev, ...arr]));
          }
        }
      } catch (_e) { /* ignore */ }
    } catch (e) {
      router.push('/quote/recognize');
    }
  }, [router]);

  // 监听"报价已保存"事件，从/quote返回后标记该零件为已报价
  useEffect(() => {
    const onStorage = () => {
      const savedIdx = sessionStorage.getItem('ai_quote_last_quoted_idx');
      if (savedIdx != null) {
        const idx = parseInt(savedIdx, 10);
        if (!isNaN(idx)) {
          setQuotedParts(prev => new Set(prev).add(idx));
          sessionStorage.removeItem('ai_quote_last_quoted_idx');
        }
      }
    };
    window.addEventListener('storage', onStorage);
    // 自定义事件（同tab内返回时触发）
    const onCustomEvent = () => onStorage();
    window.addEventListener('ai-quote-saved', onCustomEvent);
    // 页面聚焦时也检查（从/quote返回）
    const onFocus = () => onStorage();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ai-quote-saved', onCustomEvent);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handlePartClick = (idx: number) => {
    if (!payload) return;
    const part = payload.products[idx];
    if (part._failed) return;
    const effectiveMaterial = part.material_grade;
    if (!effectiveMaterial) {
      // 弹出材料选择弹窗（每次都从「五大类」顶层开始）
      setMaterialModalCat(null);
      setMaterialModalChild(null);
      setMaterialModalIdx(idx);
      return;
    }
    navigateToQuote(idx, effectiveMaterial);
  };

  // 改材质：已选过材料的零件，点「改材质」按钮重新弹选择弹窗（卡片点击仍是进报价页，两者不冲突）。
  // 若该零件此前选过大类›类别且该类别有子件，直接钻取到子件层，少点一次。
  const openChangeMaterial = (idx: number) => {
    if (!payload) return;
    const part = payload.products[idx];
    if (part?._failed) return;
    const ptKey = String(part._material_pt || '');
    const catKey = String(part._material_cat || '');
    if (ptKey && catKey) {
      const g = MATERIAL_GROUPS.find(gr => gr.ptKey === ptKey);
      const c = g?.cats.find(ct => ct.key === catKey);
      if (g && c && c.children && c.children.length) {
        setMaterialModalCat({ ptKey: g.ptKey, ptLabel: g.ptLabel, key: c.key, label: c.label, children: c.children });
        setMaterialModalIdx(idx);
        return;
      }
    }
    setMaterialModalCat(null);
    setMaterialModalChild(null);
    setMaterialModalIdx(idx);
  };

  // partOverride：弹窗里刚写入 _material_* 的新零件对象（setPayload 是异步的，
  // 直接用 payload 会拿到更新前的旧对象 ⇒ 选的大类/类别/子件带不进报价页）
  const navigateToQuote = (idx: number, material: string, partOverride?: PartData) => {
    const part = partOverride || payload!.products[idx];
    const partToStore = { ...part, material_grade: material };
    sessionStorage.setItem('ai_quote_selected_idx', String(idx));
    sessionStorage.setItem('ai_quote_selected_part', JSON.stringify(partToStore));
    router.push('/quote?from=parts');
  };

  // 选中表面处理：立即生效、不关弹窗（业主 2026-11-02：材质弹窗加表面处理选填，默认无）
  // 「无」= 清空字段（后端不收表面处理费）；已报价零件改表面处理后作废标记，需重新报价
  const handleModalSurfaceSelect = (st: string) => {
    if (materialModalIdx === null || !payload) return;
    const targetIdx = materialModalIdx;
    const val = st === '无' ? '' : st;
    const updatedProducts = [...payload.products];
    updatedProducts[targetIdx] = { ...updatedProducts[targetIdx], surface_treatment: val };
    const updatedPayload = { ...payload, products: updatedProducts };
    sessionStorage.setItem('ai_quote_parts', JSON.stringify(updatedPayload));
    setPayload(updatedPayload);
    if (val) {
      setQuotedParts(prev => {
        if (!prev.has(targetIdx)) return prev;
        const next = new Set(prev);
        next.delete(targetIdx);
        try {
          const existing = sessionStorage.getItem('ai_quote_batch_quoted');
          const arr: number[] = existing ? JSON.parse(existing) : [];
          sessionStorage.setItem('ai_quote_batch_quoted', JSON.stringify(arr.filter((i: number) => i !== targetIdx)));
        } catch (_e) { /* ignore */ }
        return next;
      });
    }
  };
  // 选中材料：material=展示用牌号；ptKey/catKey/child 用于把「大类/类别/子件」原样带进报价页。
  // 改材质模式（零件此前已有材料）：选择后就地生效、留在本页；若已报价过则作废绿色✓，需重新报价。
  // 首次选材料模式（原行为）：选择后写入并直接跳转报价页。
  const handleModalMaterialSelect = (material: string, ptKey?: string, catKey?: string, childVal?: string) => {
    if (materialModalIdx === null || !payload) return;
    const targetIdx = materialModalIdx;
    const hadMaterial = String(payload.products[targetIdx]?.material_grade || '').trim() !== '';
    // 更新该零件的材料
    const updatedProducts = [...payload.products];
    updatedProducts[targetIdx] = {
      ...updatedProducts[targetIdx],
      material_grade: material,
      _material_pt: ptKey || '',
      _material_cat: catKey || '',
      _material_child: childVal || '',
    };
    const updatedPayload = { ...payload, products: updatedProducts };
    sessionStorage.setItem('ai_quote_parts', JSON.stringify(updatedPayload));
    setPayload(updatedPayload);
    setMaterialModalIdx(null);
    setMaterialModalCat(null);
    setMaterialModalChild(null);
    if (hadMaterial) {
      // 材质已变更：作废旧的「已报价」标记（旧报价是按旧材质算的），状态与会话存储同步清除
      setQuotedParts(prev => {
        if (!prev.has(targetIdx)) return prev;
        const next = new Set(prev);
        next.delete(targetIdx);
        try {
          const existing = sessionStorage.getItem('ai_quote_batch_quoted');
          const arr: number[] = existing ? JSON.parse(existing) : [];
          sessionStorage.setItem('ai_quote_batch_quoted', JSON.stringify(arr.filter((i: number) => i !== targetIdx)));
        } catch (_e) { /* ignore */ }
        return next;
      });
      return;
    }
    navigateToQuote(targetIdx, material, updatedProducts[targetIdx]);
  };

  // 批量生成报价：点击"立即生成"先弹出零件明细，用户手工勾选要生成的零件
  const openBatchModal = () => {
    if (!user) {
      if (typeof window !== 'undefined') window.alert('请先登录后再批量生成报价');
      router.push('/login?redirect=/quote/parts');
      return;
    }
    if (!payload) return;
    const products = payload.products;

    // 批量生成要求所有非失败、未报价的待处理零件都已设材料：若 AI 未预填，提示先选材质
    const missingMaterial = products.map((p, idx) =>
      (!quotedParts.has(idx) && !p._failed && !String(p.material_grade || '').trim()) ? idx : -1
    ).filter(i => i !== -1);
    if (missingMaterial.length > 0) {
      setBatchError(`有 ${missingMaterial.length} 个零件未选择材料，请先点击零件卡片选择材质后再批量生成。`);
      setBatchGenerating(false);
      setBatchDone(false);
      setBatchSummary('');
      return;
    }

    // 默认勾选：非失败 + 已设材料 + 尚未报价的零件（已报价的也可手动勾选重算）
    const def: number[] = [];
    products.forEach((p, idx) => {
      if (p._failed) return;
      if (!String(p.material_grade || '').trim()) return;
      if (!quotedParts.has(idx)) def.push(idx);
    });
    setBatchSelected(new Set(def));
    setBatchError('');
    setBatchModalOpen(true);
  };

  // 按用户勾选的索引，逐个计算并保存
  const runBatchGenerate = async (selectedIdx: number[]) => {
    if (!user || !payload) return;
    const products = payload.products;

    // 收集可构造参数的待处理零件（已剔除缺尺寸/无法判型的，后端会报错，这里先标记）
    const toProcess: number[] = [];
    const skippedInitial: Record<number, string> = {};
    const planWarnings: string[] = [];
    selectedIdx.forEach(idx => {
      const p = products[idx];
      const built = buildPartPayload(p, idx, batchSheetPlan);
      if (built.skipReason) { skippedInitial[idx] = built.skipReason; return; }
      // 板材方案前置校验：开模算不出模具费/激光不可用时阻断（业主 2026-11-02：选了开模却按激光出价，模具费丢失）
      if (built.payload.product_type === 'sheet_metal') {
        const nm = partNameOf(p, idx);
        if (batchSheetPlan === 'open_mold' && built.payload.mold_cost == null) {
          planWarnings.push(`${nm}：开模方案算不出模具费（非标或尺寸不全）`);
        } else if (batchSheetPlan === 'laser' && built.payload.laser_cutting_fee == null) {
          planWarnings.push(`${nm}：激光切割不可用（板厚超22mm或缺切割尺寸）`);
        }
      }
      toProcess.push(idx);
    });
    if (planWarnings.length > 0) {
      const planName = batchSheetPlan === 'open_mold' ? '开模（冲压模）' : batchSheetPlan === 'existing_mold' ? '现有模具（免模具费）' : '激光切割';
      window.alert(`当前板材加工方案：${planName}\n\n${planWarnings.join('\n')}\n\n请改选其他加工方案，或先补全零件尺寸。`);
      return;
    }

    if (toProcess.length === 0) {
      setBatchDone(true);
      setBatchSummary('没有需要生成的零件（所选零件均无法处理）。');
      setBatchModalOpen(false);
      return;
    }

    setBatchGenerating(true);
    setBatchDone(false);
    setBatchSummary('');
    setBatchError('');
    setBatchProgress({ done: 0, total: toProcess.length, success: 0, skipped: 0 });

    const successIdx: number[] = [];
    const savedQuoteIds: string[] = [];
    for (const idx of toProcess) {
      const p = products[idx];
      const built = buildPartPayload(p, idx, batchSheetPlan);
      if (built.skipReason) { setBatchProgress(pr => ({ ...pr, done: pr.done + 1, skipped: pr.skipped + 1 })); continue; }
      try {
        const res = await fetch('/api/v1/quote/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(built.payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          console.warn('[批量生成] 计算失败', idx, data?.error);
          setBatchProgress(pr => ({ ...pr, done: pr.done + 1, skipped: pr.skipped + 1 }));
          continue;
        }
        // 计算成功 → 保存。result 用完整 API 响应并补 unit_price 别名（历史列表读 result.unit_price）
        const result: Record<string, any> = {
          ...data,
          unit_price: data.unit_price_ex_tax,
          unit_price_inc_tax: data.unit_price_in_tax,
        };
        const saved = await saveQuoteToAPI(user.id, built.params, result, built.productTypeZh, undefined, undefined, undefined, partNameOf(p, idx));
        if (saved) {
          successIdx.push(idx);
          savedQuoteIds.push(saved.id);
          setBatchProgress(pr => ({ ...pr, done: pr.done + 1, success: pr.success + 1 }));
        } else {
          setBatchProgress(pr => ({ ...pr, done: pr.done + 1, skipped: pr.skipped + 1 }));
        }
      } catch (err) {
        console.error('[批量生成] 异常', idx, err);
        setBatchProgress(pr => ({ ...pr, done: pr.done + 1, skipped: pr.skipped + 1 }));
      }
    }

    setBatchGenerating(false);
    setBatchDone(true);
    setBatchModalOpen(false);

    // 标记已生成的零件为已报价
    setQuotedParts(prev => {
      const next = new Set(prev);
      successIdx.forEach(i => next.add(i));
      // 持久化（含之前已保存的）
      try {
        const existing = sessionStorage.getItem('ai_quote_batch_quoted');
        const arr: number[] = existing ? (JSON.parse(existing) as number[]) : [];
        const merged = Array.from(new Set([...arr, ...next]));
        sessionStorage.setItem('ai_quote_batch_quoted', JSON.stringify(merged));
      } catch (_e) { /* ignore */ }
      return next;
    });

    const skippedCount = toProcess.length - successIdx.length;
    const initSkipCount = Object.keys(skippedInitial).length;
    let msg = `批量生成完成：成功保存 ${successIdx.length} 个`;
    if (skippedCount > 0) msg += `，计算/保存失败 ${skippedCount} 个`;
    if (initSkipCount > 0) msg += `；另有 ${initSkipCount} 个初始跳过（已报价/识别失败/缺尺寸）`;
    const planLabel = batchSheetPlan === 'open_mold' ? '开模（冲压模）' : batchSheetPlan === 'existing_mold' ? '现有模具（免模具费）' : '激光切割';
    msg += `。板材已按「${planLabel}」方案计价`;
    setBatchSummary(msg);

    // 自动跳转导出报价单页并预选刚生成的报价（业主 2026-11-02：免得再选一次产品）
    if (savedQuoteIds.length > 0) {
      try {
        sessionStorage.setItem('ai_quote_sheet_pick', JSON.stringify(savedQuoteIds));
        sessionStorage.setItem('ai_quote_open_sheet', '1');
      } catch { /* ignore */ }
      router.push('/quote');
    }
  };

  const getPartType = (p: PartData): { label: string; color: string; icon: any } => {
    if (p._isSheet || p.is_sheet_metal || p.area_method === 'sheet_metal' || p.process_type === 'sheet_metal') {
      return { label: '钣金折弯', color: 'bg-violet-100 text-violet-700', icon: Layers };
    }
    if (p.process_type === 'extrusion' || p.die_type || p.perimeter) {
      return { label: '挤压型材', color: 'bg-blue-100 text-blue-700', icon: Box };
    }
    return { label: '零件', color: 'bg-slate-100 text-slate-600', icon: Package };
  };

  const getPartDims = (p: PartData): string => {
    if (p._isSheet || p.is_sheet_metal) {
      const parts: string[] = [];
      if (p.unfold_length_mm != null && p.unfold_width_mm != null) parts.push(`${p.unfold_length_mm}×${p.unfold_width_mm}`);
      else if (p.length != null && p.width != null) parts.push(`${p.length}×${p.width}`);
      if (p.thickness_mm != null) parts.push(`t${p.thickness_mm}`);
      else if (p.wall_thickness != null) parts.push(`t${p.wall_thickness}`);
      if (p.bend_count != null && p.bend_count > 0) parts.push(`${p.bend_count}折`);
      return parts.join(' ') || '-';
    }
    // 挤压
    const parts: string[] = [];
    if (p.width != null && p.height != null) parts.push(`${p.width}×${p.height}`);
    if (p.wall_thickness != null) parts.push(`t${p.wall_thickness}`);
    if (p.length != null) parts.push(`L${p.length}`);
    return parts.join(' ') || '-';
  };

  const getPartName = (p: PartData, idx: number): string => {
    const baseName = p.part_number || p._partName || p.product_code || p.product_name || p.part_name || `零件${idx + 1}`;
    const fileName = p._fileName;
    if (fileName) {
      const shortName = fileName.replace(/\.[^.]+$/, '');
      if (baseName.startsWith('零件')) {
        return `${shortName} #${idx + 1}`;
      }
      return `${baseName} (${shortName})`;
    }
    return baseName;
  };

  if (!payload) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const totalParts = payload.products.length;
  const quotedCount = quotedParts.size;
  const isAssembly = payload.isAssembly || totalParts > 1;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopNavLinks />
      <div className="bg-white border-b border-slate-100 px-6 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-700">首页</Link>
          <span className="text-slate-300">/</span>
          <Link href="/quote" className="hover:text-slate-700">AI报价</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-medium">零件列表</span>
        </div>
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* 顶部导航：「识别结果」只是标签，降档；重新上传是高频主动作（每次传新图纸都走它）给实心蓝按钮；
              手动报价是另一套流程，保持文字链；与卡片「进入报价」同属主要动作，分区域不打架 */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Layers size={20} className="text-blue-600" />
                  {isAssembly ? '装配体零件列表' : '识别结果'}
                </h1>
                <p className="text-slate-500 mt-1 text-sm">
                  {isAssembly
                    ? `识别到 ${totalParts} 个零件，点击零件卡片开始逐个报价`
                    : '图纸识别完成，点击进入报价'}
                  {payload.fileName && <span className="text-slate-400 ml-1">· {payload.fileName}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href="/quote" className="text-sm text-slate-500 hover:text-slate-700">手动报价</Link>
                <Link
                  href="/quote/recognize"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                >
                  <Upload size={15} /> 重新上传
                </Link>
              </div>
            </div>
          </div>

          {/* 批量生成报价 */}
          <div className="bg-white rounded-xl border border-blue-200 p-4 mb-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Zap size={16} className="text-blue-600" /> 批量生成报价
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  用默认 / AI 预填值，一键为全部零件计算并保存报价（无需逐一点击确认）
                </p>
              </div>
              <button
                onClick={openBatchModal}
                disabled={batchGenerating}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-600 text-blue-700 bg-white text-sm font-medium hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {batchGenerating ? (
                  <><Loader2 size={15} className="animate-spin" /> 生成中 {batchProgress.done}/{batchProgress.total}</>
                ) : (
                  <><Zap size={15} /> 立即生成</>
                )}
              </button>
            </div>
            {batchGenerating && batchProgress.total > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                />
              </div>
            )}
            {batchError && (
              <p className="text-xs text-amber-700 mt-2">{batchError}</p>
            )}
            {batchDone && batchSummary && (
              <p className="text-xs text-slate-600 mt-2">{batchSummary}</p>
            )}
          </div>

          {/* 进度条 */}
          {isAssembly && totalParts > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">报价进度</span>
                <span className="text-sm text-slate-500">{quotedCount}/{totalParts} 已完成</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${(quotedCount / totalParts) * 100}%` }}
                />
              </div>
              {quotedCount === totalParts && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={16} /> 所有零件报价完成
                  </p>
                  <Link href="/history" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    去「我的报价」多选导出 <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 型材截面缺失提示：后端对部分型材会先走板材分支，之后不再提取截面，
              section_* 全空 → 报价页一片空白、价格 ¥--。这里显式告知，避免用户以为是系统坏了 */}
          {(() => {
            const missing: any[] = (payload.products || []).filter((p: any) =>
              !p._failed &&
              !(p.is_sheet_metal === true || p._isSheetMetal === true || p.product_type === 'sheet_metal') &&
              p.section_area_mm2 == null && p.crossSectionArea == null &&
              p.section_width_mm == null && p.width == null);
            if (missing.length === 0) return null;
            return (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                ⚠️ 有 <b>{missing.length}</b> 个零件判定为<b>型材</b>，但未能提取截面尺寸（宽 / 高 / 外周长 / 截面积）。
                进入报价页后请手动填写；填了截面积会自动算出米重。
              </div>
            );
          })()}

          {/* 零件卡片列表 */}
          <div className="space-y-2">
            {payload.products.map((p, idx) => {
              const type = getPartType(p);
              const TypeIcon = type.icon;
              const isQuoted = quotedParts.has(idx);
              const isFailed = p._failed;
              const dieLabel = p.die_type === 'flat' ? '平模' : p.die_type === 'split' ? '分流模' : (p.die_type ? String(p.die_type) : '');

              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={isFailed ? -1 : 0}
                  onClick={() => { if (!isFailed) handlePartClick(idx); }}
                  onKeyDown={(e) => {
                    if (isFailed) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePartClick(idx); }
                  }}
                  className={`text-left bg-white rounded-xl border px-4 py-3 shadow-sm transition-all group
                    ${isFailed ? 'opacity-50 cursor-not-allowed border-red-200 bg-red-50' :
                      isQuoted ? 'border-emerald-200 hover:shadow-md hover:border-emerald-300' :
                      'border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer'}`}
                >
                  {/* 业主 2026-11-02：列表改详细信息行式（不平铺），列=加工方式/材料/表面处理/模具类型 */}
                  <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                    <div className="flex items-center gap-2 min-w-0 lg:w-56 shrink-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isQuoted ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                        {isQuoted ? <CheckCircle2 size={16} className="text-emerald-600" /> : <TypeIcon size={16} className="text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{getPartName(p, idx)}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${type.color}`}>{type.label}</span>
                          {((p.quantity ?? p._quantity ?? 0) > 1) && (
                            <span className="text-xs text-slate-500">×{p.quantity || p._quantity}件</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{getPartDims(p)}</div>
                      </div>
                    </div>

                  {isFailed ? (
                    <div className="text-xs text-red-600 flex items-center gap-1 flex-1 min-w-0">
                      <AlertCircle size={12} /> {p._error || '解析失败'}
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">加工方式</div>
                          <div className="text-sm text-slate-700 truncate">
                            {type.label}
                            {(p.punch_holes_total ?? 0) > 0 && ` · ${p.punch_holes_total}孔`}
                            {(p.cnc_total_holes ?? 0) > 0 && ` · CNC${p.cnc_total_holes}孔`}
                          </div>
                          {p.weight_g != null && (
                            <div className="text-[11px] text-slate-400 truncate">重 {p.weight_g}g{p.meter_weight != null ? ` / ${p.meter_weight}kg·m⁻¹` : ''}</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">材料</div>
                          {p.material_grade ? (
                            <div className="text-sm text-slate-700 truncate">{p.material_grade}</div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openChangeMaterial(idx); }}
                              className="text-sm text-amber-500 hover:text-amber-600 font-medium truncate"
                            >
                              待选择 <Pencil size={11} className="inline" />
                            </button>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">表面处理</div>
                          <div className="text-sm text-slate-700 truncate">{p.surface_treatment || '无'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">模具类型</div>
                          <div className="text-sm text-slate-700 truncate">{dieLabel || '—'}</div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {isQuoted ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium">
                            <CheckCircle2 size={14} /> 已报价 · 查看
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium group-hover:bg-blue-700 transition">
                            进入报价 <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        )}
                        {p.material_grade && (
                          <button
                            type="button"
                            aria-label={`修改 ${getPartName(p, idx)} 的材质`}
                            title="修改材质"
                            onClick={(e) => { e.stopPropagation(); openChangeMaterial(idx); }}
                            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {!isFailed && (
                          <ChevronRight size={18} className={`hidden md:block shrink-0 transition-transform ${isQuoted ? 'text-emerald-400' : 'text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5'}`} />
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 材料选择弹窗 */}
          {materialModalIdx !== null && payload && (() => {
            const mp = payload.products[materialModalIdx];
            const mpName = getPartName(mp, materialModalIdx);
            const isChangeMode = String(mp?.material_grade || '').trim() !== '';
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setMaterialModalIdx(null); setMaterialModalCat(null); setMaterialModalChild(null); }}>
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-800">{isChangeMode ? '修改材料' : '选择材料'}</h3>
                    <button onClick={() => { setMaterialModalIdx(null); setMaterialModalCat(null); setMaterialModalChild(null); }} className="text-slate-400 hover:text-slate-600">
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">
                    {isChangeMode
                      ? <>零件 <b>{mpName}</b> 当前材质 <b>{mp.material_grade}</b>，点击选择新材质后立即生效</>
                      : <>零件 <b>{mpName}</b> 需要选择材料才能报价</>}
                  </p>
                  {materialModalCat ? (() => {
                    const c = materialModalCat;
                    const grades = GRADE_OPTIONS[c.ptKey + '-' + c.key] || [];
                    const showGrades = (grades.length > 0) && (materialModalChild !== null || c.children.length === 0);
                    if (showGrades) {
                      // 牌号层：异型材（无形状子件）直接进；标准件/钢标准件选完形状后进（业主 2026-11-02 加子牌号）
                      return (
                        <div>
                          <button
                            onClick={() => { if (materialModalChild) setMaterialModalChild(null); else setMaterialModalCat(null); }}
                            className="mb-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            ← 返回 · {materialModalChild ? c.label : c.ptLabel}
                          </button>
                          <div className="text-xs font-semibold text-slate-500 mb-1.5">{c.ptLabel} › {c.label}{materialModalChild ? ` › ${materialModalChild.label}` : ''} › 选择牌号</div>
                          <div className="max-h-[60vh] overflow-y-auto grid grid-cols-3 gap-2 pr-1">
                            {grades.map(gr => (
                              <button
                                key={c.ptKey + '-' + c.key + '-' + (materialModalChild?.value || '') + '-' + gr.value}
                                onClick={() => handleModalMaterialSelect(gr.value, c.ptKey, c.key, materialModalChild?.value || '')}
                                className="px-2 py-2 text-sm rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-slate-700 font-medium"
                              >
                                {gr.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <button
                          onClick={() => setMaterialModalCat(null)}
                          className="mb-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          ← 返回 · {c.ptLabel}
                        </button>
                        <div className="text-xs font-semibold text-slate-500 mb-1.5">{c.ptLabel} › {c.label}</div>
                        <div className="max-h-[60vh] overflow-y-auto grid grid-cols-3 gap-2 pr-1">
                          {c.children.map(ch => (
                            <button
                              key={c.ptKey + '-' + c.key + '-' + ch.value}
                              onClick={() => {
                                const gr = GRADE_OPTIONS[c.ptKey + '-' + c.key];
                                if (gr && gr.length) setMaterialModalChild({ label: ch.label, value: ch.value });
                                else handleModalMaterialSelect(ch.value, c.ptKey, c.key, ch.value);
                              }}
                              className="px-2 py-2 text-sm rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-slate-700 font-medium"
                            >
                              {ch.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                      {MATERIAL_GROUPS.map(g => (
                        <div key={g.ptKey}>
                          <div className="text-xs font-semibold text-slate-500 mb-1.5">{g.ptLabel}</div>
                          <div className="grid grid-cols-3 gap-2">
                            {g.cats.map(c => (
                              <button
                                key={g.ptKey + '-' + c.key}
                                onClick={() => {
                                  if (c.children && c.children.length) {
                                    setMaterialModalCat({ ptKey: g.ptKey, ptLabel: g.ptLabel, key: c.key, label: c.label, children: c.children });
                                  } else if (GRADE_OPTIONS[g.ptKey + '-' + c.key]?.length) {
                                    // 无形状但有牌号（异型材）：进牌号层（业主 2026-11-02）
                                    setMaterialModalCat({ ptKey: g.ptKey, ptLabel: g.ptLabel, key: c.key, label: c.label, children: [] });
                                    setMaterialModalChild(null);
                                  } else {
                                    handleModalMaterialSelect(c.label, g.ptKey, c.key, '');
                                  }
                                }}
                                className="px-2 py-2 text-sm rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-slate-700 font-medium flex items-center justify-center gap-0.5"
                              >
                                {c.label}
                                {c.children && c.children.length ? <span className="text-[10px] text-slate-400">›</span> : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* 表面处理（选填，默认无）：立即生效；已报价零件改后作废需重新报价（业主 2026-11-02） */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 mb-1.5">表面处理（选填，默认无）</div>
                        <div className="grid grid-cols-3 gap-2">
                          {SURFACE_OPTIONS.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleModalSurfaceSelect(s)}
                              className={`px-2 py-2 text-sm rounded-lg border transition font-medium ${
                                (mp.surface_treatment || '') === s || (s === '无' && !mp.surface_treatment)
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 批量生成 · 选择零件弹窗（用户手工勾选要生成的零件） */}
          {batchModalOpen && payload && (() => {
            const selectable: number[] = [];
            payload.products.forEach((p, idx) => {
              if (!p._failed && String(p.material_grade || '').trim()) selectable.push(idx);
            });
            const allSelected = selectable.length > 0 && selectable.every(i => batchSelected.has(i));
            const toggleAll = () => {
              setBatchSelected(prev => {
                const next = new Set(prev);
                if (allSelected) selectable.forEach(i => next.delete(i));
                else selectable.forEach(i => next.add(i));
                return next;
              });
            };
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => { if (!batchGenerating) setBatchModalOpen(false); }}
              >
                <div
                  className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Zap size={18} className="text-blue-600" /> 批量生成报价 · 选择零件
                    </h3>
                    <button
                      onClick={() => { if (!batchGenerating) setBatchModalOpen(false); }}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
                      disabled={batchGenerating}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    勾选要生成报价的零件，确认后将逐个计算并保存报价。已报价零件也可重新勾选覆盖。
                  </p>
                  {payload.products.some((p) => !p._failed && resolveApiType(p).apiType === 'sheet_metal') && (() => {
                    const hasSheet = payload.products.some((p, idx) => !p._failed && String(p.material_grade || '').trim() && resolveApiType(p).apiType === 'sheet_metal' && batchSelected.has(idx));
                    return (
                      <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 p-2.5">
                        <div className="text-xs font-semibold text-purple-800 mb-1.5">板材加工方案（出单前必选：开模 / 现模 / 激光切割）</div>
                        <div className="flex flex-wrap gap-1.5">
                          {([['laser', '激光切割（默认）'], ['open_mold', '开模（冲压模）'], ['existing_mold', '现有模具（免模具费）']] as const).map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              disabled={batchGenerating}
                              onClick={() => updateBatchSheetPlan(v)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                                batchSheetPlan === v
                                  ? 'bg-purple-600 border-purple-600 text-white'
                                  : 'bg-white border-purple-200 text-purple-700 hover:bg-purple-50'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {hasSheet && (
                          <div className="text-[11px] text-purple-600 mt-1.5">
                            已选零件含板材，将按「{batchSheetPlan === 'laser' ? '激光切割' : batchSheetPlan === 'open_mold' ? '开模（冲压模，模具费单独列出）' : '现有模具（免模具费）'}」方案计算
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={batchGenerating || selectable.length === 0}
                      />
                      全选（共 {selectable.length} 个可生成）
                    </label>
                    <span className="text-xs text-slate-400">已选 {batchSelected.size} 个</span>
                  </div>
                  <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
                    {payload.products.map((p, idx) => {
                      const type = getPartType(p);
                      const hasMat = String(p.material_grade || '').trim() !== '';
                      const disabled = p._failed || !hasMat || batchGenerating;
                      const checked = batchSelected.has(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 rounded-lg border p-3 transition
                            ${disabled ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                              : checked ? 'border-blue-300 bg-blue-50 cursor-pointer'
                              : 'border-slate-200 hover:border-blue-200 cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => setBatchSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              return next;
                            })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800 truncate">{getPartName(p, idx)}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${type.color}`}>{type.label}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              {p.material_grade ? (
                                <span>材质: {p.material_grade}</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={batchGenerating}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBatchModalOpen(false); setMaterialModalCat(null); setMaterialModalChild(null); setMaterialModalIdx(idx); }}
                                  className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600 font-medium"
                                >
                                  材质: 待选择·点击补选 <Pencil size={11} />
                                </button>
                              )}
                              <span>尺寸: {getPartDims(p)}</span>
                              {(p.quantity ?? p._quantity) ? <span>数量: {p.quantity || p._quantity}</span> : null}
                            </div>
                            {p._failed && <div className="text-xs text-red-500 mt-1">识别失败，无法生成</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setBatchModalOpen(false)}
                      disabled={batchGenerating}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => runBatchGenerate(Array.from(batchSelected))}
                      disabled={batchGenerating || batchSelected.size === 0}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      {batchGenerating ? (
                        <><Loader2 size={15} className="animate-spin" /> 生成中 {batchProgress.done}/{batchProgress.total}</>
                      ) : (
                        <><Zap size={15} /> 确认生成（{batchSelected.size}）</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 底部提示 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">使用提示</p>
                <ul className="text-blue-700 space-y-0.5 text-xs leading-relaxed">
                  <li>• 点击零件卡片进入报价页面，AI参数已预填，确认无误后点击「保存报价」</li>
                  <li>• 保存后自动回到零件列表，已报价零件标记为绿色✓</li>
                  <li>• 全部零件报价完成后，在「我的报价」页面多选零件导出汇总报价单</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
