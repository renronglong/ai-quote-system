"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2, AlertTriangle, User, CheckCircle2, Share2, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { PRODUCT_TYPES } from './QuoteForm';
import { useFileAccept, useIsMobileUa } from '@/lib/use-file-accept';
import { loadPdfJs } from '@/lib/pdfjs';

// ==================== Types ====================

interface DrawingRecognitionProps {
  onDrawingData: (data: {
    recogData: Record<string, any> | null;
    recognitionId?: string;
    checkAnswers?: Record<string, any>;
    recogProducts?: Record<string, any>[];
    isAssembly?: boolean;
    fileName?: string;
  }) => void;
  user: any;
  aiData?: any;
  mode?: 'single' | 'continuous';
}

interface CompletedResult {
  id: string;
  fileName: string;
  products: Record<string, any>[];
  isAssembly: boolean;
  recognitionId?: string;
  error?: string;
}

interface PartInfo {
  part_id: string;
  product_name: string;
  quantity: number;
  section_width_mm: number;
  section_height_mm: number;
  outer_perimeter_mm: number;
  inner_perimeter_mm: number;
  section_area_mm2: number;
  weight_kg_per_m: number;
  wall_thickness_mm: number;
  is_hollow: boolean;
  die_type: string;
  extrusion_direction: string;
  extrusion_length_mm: number;
  bounding_box_mm: [number, number, number];
  volume_mm3: number;
}

// Allowed upload extensions
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.dxf', '.dwg', '.stp', '.step', '.igs', '.iges', '.x_t', '.zip', '.rar', '.7z', '.tar', '.gz'];

// 图片扩展名 — 触发AI识别
const AI_RECOG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.dxf', '.dwg', '.stp', '.step', '.igs', '.iges', '.x_t', '.zip', '.rar', '.7z', '.tar', '.gz'];
// 上传区直接展示的能力标签（与实测结果一致，别再写支持但实际不支持）
// X_T（Parasolid）2026-10-16 实测已可解析（P2-19 前漏标）
const SUPPORTED_TAGS = ['STP', 'STEP', 'X_T', 'DXF', 'DWG', 'PDF', 'JPG', 'PNG', 'ZIP', 'RAR', '7Z', 'TAR'];

// CAD扩展名 — 本地解析或转发
const CAD_EXTS = ['.dxf', '.dwg', '.step', '.stp', '.igs'];

// 单文件体积上限：Vercel Serverless 请求体 4.5MB，超了会直接 413
const MAX_FILE_BYTES = 4.5 * 1024 * 1024;

// 扩展名在允许列表里，但当前仍会用不了 —— 选到就立刻说清，不让用户白等
// RAR / 7Z 后端已于 2026-10-09 装好 p7zip，实测可用，不再拦截
const FORMAT_BLOCKED: Record<string, string> = {
  '.gz': 'GZ 压缩包解压后会丢失图纸扩展名（服务端解出的是无后缀文件名，识别不出来）。请改用 ZIP / TAR，或打包成 .tar.gz。',
};

// P2-18：识别成功但置信度未过自动填报阈值（needs_human / handoff_reason）的零件标记。
// 数据仍会提交进零件列表（不再丢弃成「0 个零件」死路），由用户在报价页人工核对。
const isLowConfidencePart = (p: any): boolean =>
  !!p && (p.needs_human === true || !!p.handoff_reason ||
    (typeof p.confidence === 'number' && p.confidence > 0 && p.confidence < 0.75));

const processToProductType: Record<string, string> = {
  '挤压铝型材': '挤出', '板材': '板材', '铝板': '板材',
  '锌合金压铸': '压铸', '铝合金压铸': '压铸', '注塑': '注塑',
};

// 将后端返回的零件/单件数据转为前端recogData格式
function buildRecogDataFromParse(parseJson: any, productType: string, source: string, fileName?: string): Record<string, any> {
  const dieTypeRaw = String(parseJson.die_type || parseJson.mold_type || '').toLowerCase();
  let dieType: string;
  if (['split', '分流模', '中空', '空心'].some(v => dieTypeRaw.includes(v))) dieType = 'split';
  else if (['flat', '平模', '实心'].some(v => dieTypeRaw.includes(v))) dieType = 'flat';
  else dieType = parseJson.die_type || parseJson.mold_type || '';

  // 钣金件优先处理：is_sheet_metal=true 或 area_method=sheet_metal 时，强制覆盖product_type
  const isSheet = parseJson.is_sheet_metal === true || parseJson.area_method === 'sheet_metal';
  const resolvedProductType = isSheet ? 'sheet_metal' : productType;

  // 兼容后端返回 part_name/part_number 或 product_name/product_code
  const resolvedProductName = parseJson.product_name || parseJson.part_name || '';
  const resolvedProductCode = parseJson.product_code || parseJson.part_number || '';

  return {
    confidence: parseJson.confidence_score != null ? parseJson.confidence_score : null,
    product_type: resolvedProductType,
    product_code: resolvedProductCode,
    product_name: resolvedProductName,
    part_name: resolvedProductName,
    part_number: resolvedProductCode,
    surface_treatment: parseJson.surface_treatment || '',
    material_grade: parseJson.material_grade || '',
    width: isSheet ? parseJson.unfold_width_mm : parseJson.section_width_mm,
    height: isSheet ? parseJson.unfold_length_mm : parseJson.section_height_mm,
    length: isSheet ? parseJson.unfold_length_mm : parseJson.extrusion_length_mm,
    perimeter: parseJson.outer_perimeter_mm,
    inner_perimeter: parseJson.inner_perimeter_mm,
    meter_weight: parseJson.weight_kg_per_m,
    wall_thickness: parseJson.wall_thickness_mm || parseJson.thickness_mm,
    crossSectionArea: parseJson.section_area_mm2,
    die_type: isSheet ? null : dieType,
    num_cavities: (parseJson.is_hollow && !isSheet) ? 1 : 0,
    // 优先用 AI 判的材料大类；原来这里填的是牌号（如 "Q235"/"6063"），
    // 大类填成牌号后下游匹配不到 ⇒ 被兜底成铝板（选钢按铝报价的根源之一）
    material_category: parseJson.material_category || parseJson.material_grade || (isSheet ? '铝板' : ''),
    // 钣金专用字段
    is_sheet_metal: isSheet,
    thickness_mm: parseJson.thickness_mm,
    sheet_thickness: parseJson.thickness_mm,
    unfold_length_mm: parseJson.unfold_length_mm,
    unfold_width_mm: parseJson.unfold_width_mm,
    bend_angle: parseJson.bend_angle_deg,
    bend_radius: parseJson.bend_radius_mm,
    bend_dimension: parseJson.bend_dimension_mm,
    unfold_length: parseJson.unfold_length_mm,
    unfold_width: parseJson.unfold_width_mm,
    unfold_size: parseJson.unfold_size,
    extrusion_length: parseJson.extrusion_length_mm,
    process: parseJson.process || null,
    secondary_operations: parseJson.secondary_operations || null,
    cnc_holes: parseJson.cnc_holes || null,
    cnc_total_holes: parseJson.cnc_total_holes || 0,
    all_holes: parseJson.all_holes || null,
    all_holes_total: parseJson.all_holes_total || 0,
    machining_time_min: parseJson.machining_time_min || null,
    quantity: parseJson.quantity || 1,
    bend_count: parseJson.bend_count || 0,
    punch_holes_total: parseJson.punch_holes_total || 0,
    // 板材下料三件套：后端已算好，这里只做透传（不参与任何计算）
    // 缺失时置 null 而非 0，避免报价页把「没有值」显示成 0
    unfold_hole_count: parseJson.unfold_hole_count ?? parseJson.hole_count ?? null,
    unfold_perimeter_mm: parseJson.unfold_perimeter_mm ?? parseJson.unfold_outer_perimeter_mm ?? parseJson.outer_perimeter_mm ?? parseJson.perimeter ?? null,
    outer_perimeter_mm: parseJson.outer_perimeter_mm ?? parseJson.perimeter ?? null,
    cut_total_path_mm: parseJson.cut_total_path_mm ?? parseJson.cut_total_length_mm ?? parseJson.total_perimeter ?? null,
    // CNC 机加几何量（A 识图 v2.4+ 输出）—— 不透传的话报价页自动节拍永远算不出来
    // ⚠️ 后端实际字段名是 toolpath_mm（无下划线分隔），这里同时写成标准名 tool_path_mm 供下游读取
    structure_v2: parseJson.structure_v2 || null,
    toolpath_mm: parseJson.toolpath_mm ?? parseJson.tool_path_mm ?? null,
    tool_path_mm: parseJson.toolpath_mm ?? parseJson.tool_path_mm ?? null,
    air_travel_mm: parseJson.air_travel_mm ?? null,
    clamp_count: parseJson.clamp_count ?? null,
    projection_volume_mm3: parseJson.projection_volume_mm3 ?? null,
    blank_volume_mm3: parseJson.blank_volume_mm3 ?? null,
    removal_volume_mm3: parseJson.removal_volume_mm3 ?? null,
    side_axes: parseJson.side_axes ?? null,
    // A 2026-10-15 新增的「逐件工时」信号：cnc_applicable 明确该零件要不要走 CNC，
    // cnc_cycle_time_min 是后端算的单件节拍（⚠️ 仅作参考/备用，计价仍按刀路自算，业主 10-15 定案）
    cnc_applicable: parseJson.cnc_applicable ?? null,
    cnc_cycle_time_min: parseJson.cnc_cycle_time_min ?? null,
    cnc_machining_seconds: parseJson.cnc_machining_seconds ?? null,
    cnc_process: parseJson.cnc_process ?? null,
    cnc_estimate: parseJson.cnc_estimate || null,
    notes: `${source}${fileName ? ': ' + fileName : ''}${isSheet ? ` | 钣金折弯件 ${parseJson.unfold_size || ''} ${parseJson.bend_angle_deg || 90}°/R${parseJson.bend_radius_mm || ''}` : ''} | ⚠️仅用于报价估算，不可作为开模依据`,
    _fileName: fileName,
    _partId: parseJson.part_id || parseJson.part_number || '',
    _quantity: parseJson.quantity || 1,
    _partName: resolvedProductName,
    _isSheetMetal: isSheet,
  };
}

/**
 * 装配体：把顶层的 CNC 信号下沉到零件上。
 * 后端 A 把 cnc_total_holes / machining_time_min / cnc_holes 只放在整件顶层，
 * parts[i] 里恒为 0 / 缺失 ⇒ 报价页判定「无 CNC」⇒ 只走锯切，加工费只剩 0.01。
 * 仅当「恰好一个」零件被判 cnc_machined 时才把整件的孔数与工时给它；
 * 多个 cnc_machined 零件则都不下沉（避免同一笔整件工时被重复计到每个零件上）。
 */
function mergeTopCncIntoParts(cadJson: any): any[] {
  const raw: any[] = cadJson.parts || [];
  const topCncHoles = Number(cadJson.cnc_total_holes) || 0;
  const topMachMin = Number(cadJson.machining_time_min) || null;
  const topCncHoleList = cadJson.cnc_holes || null;
  const cncIdxList: number[] = raw.reduce((acc: number[], p: any, i: number) => {
    if (p?.structure_v2?.type === 'cnc_machined') acc.push(i);
    return acc;
  }, []);
  const soleCncIdx = cncIdxList.length === 1 ? cncIdxList[0] : -1;
  return raw.map((p: any, idx: number) => {
    if (idx !== soleCncIdx) return p;
    const merged: any = { ...p };
    if (!(merged.cnc_total_holes > 0) && topCncHoles > 0) merged.cnc_total_holes = topCncHoles;
    if (merged.machining_time_min == null && topMachMin != null) merged.machining_time_min = topMachMin;
    if (!merged.cnc_holes && topCncHoleList) merged.cnc_holes = topCncHoleList;
    merged._cnc_from_assembly = true;
    return merged;
  });
}

// ==================== Component ====================

export default function DrawingRecognition({ onDrawingData, user, mode = 'single' }: DrawingRecognitionProps) {
  // ===== 登录 + 识图额度 =====
  const { quota, checkQuota, referralLink, ensureReferralLink } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ===== File Upload State =====
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileRemark, setFileRemark] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // 识别等待态：已用秒数 + 渐进进度（伪进度封顶 90%，避免「假 100%」）
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recogProgress, setRecogProgress] = useState(0);
  const [recogResult, setRecogResult] = useState<Record<string, any> | null>(null);
  const [recogProducts, setRecogProducts] = useState<Record<string, any>[]>([]);
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [recogError, setRecogError] = useState<string | null>(null);
  const [recognitionFailed, setRecognitionFailed] = useState(false);
  const [checkQuestions, setCheckQuestions] = useState<any[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, any>>({});
  const [showCheckDialog, setShowCheckDialog] = useState(false);
  const [deepQuoteLoading, setDeepQuoteLoading] = useState(false);
  const [isAssembly, setIsAssembly] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showFmtHelp, setShowFmtHelp] = useState(false);
  // 粘贴反馈：成功入队/被拦截都要说一声，不静默
  const [pasteHint, setPasteHint] = useState<{ ok: boolean; text: string } | null>(null);
  const pasteHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productType, setProductType] = useState('挤出');
  // 连续上传模式：队列 + 已完成结果聚合
  const isContinuous = mode === 'continuous';
  const [pendingQueue, setPendingQueue] = useState<File[]>([]);
  const [completedResults, setCompletedResults] = useState<CompletedResult[]>([]);
  const [processingQueue, setProcessingQueue] = useState(false);
  const queueRef = useRef<File[]>([]);
  const processingRef = useRef(false);
  const currentFileNameRef = useRef('');
  const committedThisRunRef = useRef(false);
  const processNextRef = useRef<() => void>(() => {});
  const recognizeFileRef = useRef<(file: File) => Promise<void>>(async () => {});
  // 最近一次入库的结果 id + AI 确认抽屉正在修订的目标 id
  // （P0-2：识别成功即入库，/api/check 的确认答案必须合并回该条，而不是再 push 一条）
  const lastCommitIdRef = useRef<string | null>(null);
  const checkTargetIdRef = useRef<string | null>(null);
  // 微信/手机端：accept 用 */* 才会出现「从聊天记录选择文件」（详见 use-file-accept）
  const fileAccept = useFileAccept(ALLOWED_EXTENSIONS.join(','));
  const isMobileUa = useIsMobileUa();

  // 识别等待态计时 + 渐进进度条：recognizing 期间每 500ms 刷新，
  // 进度前快后慢封顶 90%（真实完成由 recognizing 熄灭表示，不假装 100%）
  useEffect(() => {
    if (!recognizing) { setElapsedSec(0); setRecogProgress(0); return; }
    const t0 = Date.now();
    const timer = setInterval(() => {
      setElapsedSec((Date.now() - t0) / 1000);
      setRecogProgress(p => (p >= 90 ? 90 : p + Math.max(1.2, (90 - p) * 0.16)));
    }, 500);
    return () => clearInterval(timer);
  }, [recognizing]);

  // ===== Helper =====
  const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  // 上传前拦截：体积超限 / 服务端撑不住的格式。返回 null 表示可以放行
  const preflightError = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (file.size > MAX_FILE_BYTES) {
      return `文件 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过单文件上限 4.5MB，请压缩后再上传（ZIP 里只放需要报价的图纸）。`;
    }
    if (FORMAT_BLOCKED[ext]) return FORMAT_BLOCKED[ext];
    return null;
  };

  // 切换到指定产品（零件/多文件切换）
  const switchToProduct = useCallback((idx: number) => {
    if (idx < 0 || idx >= recogProducts.length) return;
    setSelectedProductIdx(idx);
    const product = recogProducts[idx];
    setRecogResult(product);
    if (!isContinuous) {
      onDrawingData({ recogData: product });
    }
  }, [recogProducts, onDrawingData, isContinuous]);

  // 重置识别状态
  const resetRecognitionState = useCallback(() => {
    setRecognizing(false);
    setStatusMessage(null);
    setRecogError(null);
    setRecognitionFailed(false);
    setRecogResult(null);
    setRecogProducts([]);
    setSelectedProductIdx(0);
    setIsAssembly(false);
    setCheckQuestions([]);
    setCheckAnswers({});
    setShowCheckDialog(false);
  }, []);

  // ===== 连续上传模式辅助函数 =====
  const commitResult = useCallback((payload: {
    recogData: Record<string, any> | null;
    recogProducts?: Record<string, any>[];
    isAssembly?: boolean;
    fileName?: string;
    recognitionId?: string;
    error?: string;
    checkAnswers?: Record<string, any>;
    patchId?: string;
  }) => {
    if (isContinuous) {
      const products = payload.recogProducts && payload.recogProducts.length > 0
        ? payload.recogProducts
        : (payload.recogData ? [payload.recogData] : []);
      // 修订模式（AI 确认抽屉回填）：把确认答案合并进已入库记录的第一个零件，
      // 不再新增记录 —— 否则同一文件在「已识别完成」里出现两条、零件数翻倍（P0-2）
      if (payload.patchId) {
        let patched = false;
        setCompletedResults(prev => prev.map(r => {
          if (r.id !== payload.patchId || patched) return r;
          patched = true;
          const base = r.products[0] || {};
          const patch = Object.fromEntries(
            Object.entries(payload.recogData || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
          );
          return { ...r, products: [{ ...base, ...patch }], error: undefined };
        }));
        if (patched) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          committedThisRunRef.current = true;
          return;
        }
        // 目标记录不存在（极端情况）：退回新增，至少不丢用户确认的参数
      }
      const id = 'res_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      lastCommitIdRef.current = id;
      setCompletedResults(prev => [...prev, {
        id,
        fileName: payload.fileName || currentFileNameRef.current || '',
        products,
        isAssembly: payload.isAssembly ?? products.length > 1,
        recognitionId: payload.recognitionId,
        error: payload.error,
      }]);
      // 当前文件处理完即清空，准备下一份
      setUploadedFile(null);
      resetRecognitionState();
      if (fileInputRef.current) fileInputRef.current.value = '';
      committedThisRunRef.current = true;
    } else {
      onDrawingData(payload as any);
    }
  }, [isContinuous, onDrawingData, resetRecognitionState]);

  const proceedToQuote = useCallback(() => {
    if (!completedResults.length) return;
    const allProducts: Record<string, any>[] = [];
    completedResults.forEach(r => allProducts.push(...r.products));
    const firstFileName = completedResults[0]?.fileName || '';
    const isAssembly = allProducts.length > 1 || completedResults.some(r => r.isAssembly);
    onDrawingData({
      recogData: allProducts[0] || null,
      recogProducts: allProducts,
      isAssembly,
      fileName: firstFileName,
      recognitionId: completedResults[0]?.recognitionId || 'batch_' + Date.now(),
    });
  }, [completedResults, onDrawingData]);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    if (queueRef.current.length === 0) {
      setProcessingQueue(false);
      return;
    }
    processingRef.current = true;
    setProcessingQueue(true);
    const nextFile = queueRef.current[0];
    currentFileNameRef.current = nextFile.name;
    queueRef.current = queueRef.current.slice(1);
    setPendingQueue(prev => prev.slice(1));
    setUploadedFile(nextFile);
    committedThisRunRef.current = false;
    try {
      await recognizeFileRef.current(nextFile);
    } catch (e) {
      console.warn('[processNext] recognizeFile 异常:', e);
    }
    // 若 recognizeFile 内部未提交（出错提前 return），由这里兜底标记失败并继续
    if (isContinuous && !committedThisRunRef.current) {
      commitResult({ recogData: null, error: '识别失败', fileName: nextFile.name });
    }
    processingRef.current = false;
    processNext();
  }, [isContinuous, commitResult]);
  processNextRef.current = processNext;

  // PDF文件在浏览器端用pdf.js转为PNG，再发给AI识别
  const convertPdfToPng = async (pdfFile: File): Promise<File> => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    const page = await pdf.getPage(1);
    const scale = 200 / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], pdfFile.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' }));
        } else {
          reject(new Error('PDF转图片失败'));
        }
      }, 'image/png');
    });
  };

  // 异步发起完整性检查（不阻塞主流程）
  const launchCheckAsync = useCallback((file: File) => {
    // 快照「刚入库的那条结果」：抽屉确认时把答案合并回它，而不是新增一条（P0-2）
    checkTargetIdRef.current = lastCommitIdRef.current;
    setTimeout(async () => {
      try {
        const checkFd = new FormData();
        checkFd.append('file', file);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const checkResp = await fetch('/api/check', { method: 'POST', body: checkFd, signal: controller.signal });
        clearTimeout(timeoutId);
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          if (checkData.success && checkData.questions && checkData.questions.length > 0) {
            setCheckQuestions(checkData.questions);
            setCheckAnswers({});
            setShowCheckDialog(true);
          }
        }
      } catch { /* 检查失败不影响主流程 */ }
    }, 100);
  }, []);

  const recognizeFile = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    // ===== 登录检查 =====
    if (!user) {
      setPendingFile(file);
      setShowLoginModal(true);
      return;
    }
    // ===== 额度检查 =====
    if (quota && quota.remaining <= 0) {
      setPendingFile(file);
      setShowQuotaModal(true);
      return;
    }
    // ===== 上传前拦截（体积 / 服务端不支持的格式）=====
    const blocked = preflightError(file);
    if (blocked) {
      setRecogError(blocked);
      setRecognitionFailed(true);
      return;
    }
    if (!AI_RECOG_EXTS.includes(ext)) return;

    // 重置状态
    setRecogError(null);
    setStatusMessage(null);
    setRecognitionFailed(false);
    setRecogResult(null);
    setRecogProducts([]);
    setSelectedProductIdx(0);
    setIsAssembly(false);
    setRecognizing(true);

    try {
      // ===== 自动工艺分类 =====
      const classifyFd = new FormData();
      classifyFd.append('file', file);
      try {
        setStatusMessage('正在识别工艺类型...');
        const classifyController = new AbortController();
        const classifyTimeout = setTimeout(() => classifyController.abort(), 10000);
        const classifyResp = await fetch('/api/classify', { method: 'POST', body: classifyFd, signal: classifyController.signal });
        clearTimeout(classifyTimeout);
        if (classifyResp.ok) {
          const classifyResult = await classifyResp.json();
          const processType = classifyResult.process_type || classifyResult.processType || classifyResult.process;
          const confidence = classifyResult.confidence || 0;
          if (processType && processToProductType[processType]) {
            const newProductType = processToProductType[processType];
            setProductType(newProductType);
            console.log(`[自动分类] ${processType} (置信度${(confidence*100).toFixed(0)}%) → ${newProductType}`);
          }
        }
      } catch (classifyErr) {
        console.warn('[自动分类] 失败，继续使用当前品类', classifyErr);
      }

      let fileToSend = file;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setStatusMessage('PDF正在转为图片识别...');
        fileToSend = await convertPdfToPng(file);
      }

      // ===== DXF / DWG 图纸解析：走 drawing_parser 服务 =====
      // 说明：DWG 由服务端先转成 DXF 再解析，返回结构与 DXF 完全一致，故走同一分支
      if (ext === '.dxf' || ext === '.dwg') {
        const extLabel = ext === '.dwg' ? 'DWG' : 'DXF';
        setStatusMessage(`${extLabel}正在解析...`);
        const dxfFd = new FormData();
        dxfFd.append('file', file);
        const dxfResp = await fetch('/api/drawing-parse', { method: 'POST', body: dxfFd });
        const dxfJson = await dxfResp.json();
        if (!dxfResp.ok || !dxfJson.parse_success) {
          setRecogError(dxfJson.error || dxfJson.parse_errors || `${extLabel}解析失败`);
          setRecognitionFailed(true);
          return;
        }
        // 从 dimensions 计算展开尺寸
        const dims = dxfJson.drawing_dimensions || [];
        const hDims = dims.filter((d: any) => d.direction === '水平').map((d: any) => d.measurement_mm);
        const vDims = dims.filter((d: any) => d.direction === '垂直').map((d: any) => d.measurement_mm);
        const maxH = hDims.length ? Math.max(...hDims) : 0;
        const maxV = vDims.length ? Math.max(...vDims) : 0;
        // 后端现在会在标注缺失时回填外框值，并在每条 dimension 上标 source=bbox_fallback。
        // 这种情况下不能跟用户说是「图纸标注」，得如实标成外框估算。
        const fromBbox = dims.some((d: any) => d && d.source === 'bbox_fallback');
        let sizeSource = fromBbox ? '图形外框估算（图纸无尺寸标注）' : '图纸标注';
        let unfoldL = maxH;
        let unfoldW = maxV;
        if (maxH <= 0 || maxV <= 0) {
          // 图纸没有尺寸标注（国内常见：导出 DXF 丢了标注实体）→ 退回图形外框 bbox 估算
          const bb = (dxfJson.unit && dxfJson.unit.bbox_mm) || dxfJson.bbox_mm;
          if (Array.isArray(bb) && bb.length >= 2 && bb[0] > 0 && bb[1] > 0) {
            unfoldL = Math.round(Number(bb[0]) * 100) / 100;
            unfoldW = Math.round(Number(bb[1]) * 100) / 100;
            sizeSource = '图形外框估算（图纸无尺寸标注）';
          }
        } else {
          const vCount: Record<number, number> = {};
          vDims.forEach((v: number) => { const k = Math.round(v * 10); vCount[k] = (vCount[k] || 0) + 1; });
          const bodyH = Math.max(...Object.entries(vCount).filter(([, c]) => c >= 2).map(([k]) => Number(k) / 10), 0);
          const bendExt = vDims.filter((v: number) => Math.abs(v - bodyH) > bodyH * 0.3 && Math.abs(v - maxV) < 1);
          const bendVal = bendExt.length ? Math.max(...bendExt) : 0;
          unfoldL = Math.round((maxH + bendVal) * 100) / 100;
        }
        if (unfoldL <= 0 || unfoldW <= 0) {
          setRecogError(`${extLabel}解析成功但未读到任何尺寸：图纸里既没有尺寸标注、外框也为空。请在 CAD 里补齐标注后重新上传，或直接手动填单报价。`);
          setRecognitionFailed(true);
          return;
        }
        const holes = dxfJson.hole_groups || [];
        const totalHoles = dxfJson.hole_count || holes.reduce((s: number, h: any) => s + h.count, 0);
        const holeDesc = holes.map((h: any) => `Ø${h.diameter_mm}×${h.count}`).join(' + ');
        const recogData: Record<string, any> = {
          confidence: null,
          product_type: productType === '板材' ? 'stamping' : productType,
          material_category: '铝板',
          unfold_length: unfoldL,
          unfold_width: unfoldW,
          hole_count: totalHoles,
          thickness: null,
          notes: `${extLabel}解析 | 展开${unfoldL}×${unfoldW}mm（${sizeSource}） | 孔: ${holeDesc || '无'} | ⚠️仅用于报价估算，不可作为开模依据`,
        };
        setRecogResult(recogData);
        checkQuota();
        setStatusMessage(null);
        setRecognizing(false);
        commitResult({ recogData, recognitionId: "dxf_" + Date.now(), fileName: file.name });
        return;
      }

      // ===== ZIP 压缩包：解压后遍历所有图纸文件 =====
      const isZip = ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);
      if (isZip) {
        setStatusMessage('压缩包正在解压...');
        const zipFd = new FormData();
        zipFd.append('file', file);
        let zipResp = await fetch('/api/extract', { method: 'POST', body: zipFd });
        // 解压服务偶发 5xx（实测 ZIP 首次 502、重试即成功），这里重试一次
        if (!zipResp.ok) {
          setStatusMessage('解压服务响应异常，正在重试...');
          zipResp = await fetch('/api/extract', { method: 'POST', body: zipFd });
        }
        const zipJson = await zipResp.json();
        if (!zipResp.ok || !zipJson.success) {
          const raw = String(zipJson.error || zipJson.detail || '');
          setRecogError(
            raw.includes('7z')
              ? '暂不支持 RAR / 7Z 压缩包。请改用 ZIP 或 TAR 重新打包后上传。'
              : (zipJson.error || '压缩包解压失败，请确认文件未损坏，或改用 ZIP / TAR 格式')
          );
          setRecognitionFailed(true);
          return;
        }
        const files = zipJson.files || [];
        if (files.length === 0) {
          setRecogError('压缩包中没有可识别的文件');
          setRecognitionFailed(true);
          return;
        }
        const DRAWABLE_EXTS = ['.stp', '.step', '.igs', '.iges', '.x_t', '.dwg', '.dxf', '.pdf'];
        const targetFiles = files.filter((f: any) => DRAWABLE_EXTS.includes('.' + f.name.split('.').pop()?.toLowerCase()));
        if (targetFiles.length === 0) {
          setRecogError('压缩包中没有支持的图纸格式(STP/DXF/DWG/PDF)');
          setRecognitionFailed(true);
          return;
        }
        setStatusMessage(`解压成功，共 ${targetFiles.length} 个文件，正在批量识别...`);

        // 第一个文件先做一次工艺分类（批量接口不返回分类）
        try {
          const clsFd = new FormData();
          clsFd.append('file_id', targetFiles[0].file_id);
          const clsResp = await fetch('/api/classify', { method: 'POST', body: clsFd });
          if (clsResp.ok) {
            const classifyData = await clsResp.json();
            const mapped = processToProductType[classifyData.process_type_cn];
            if (mapped && PRODUCT_TYPES[mapped] && mapped !== productType) {
              setProductType(mapped);
            }
          }
        } catch { /* 分类失败忽略 */ }

        // 优先走后端批量解析（并发）；失败才退回逐个解析
        let allProducts: Record<string, any>[] = [];
        let usedBatch = false;
        try {
          const batchResp = await fetch('/api/parse-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_ids: targetFiles.map((f: any) => f.file_id) }),
          });
          const batchJson = await batchResp.json();
          if (batchResp.ok && batchJson.success && Array.isArray(batchJson.results)) {
            usedBatch = true;
            const nameById: Record<string, string> = {};
            targetFiles.forEach((f: any) => { nameById[f.file_id] = f.name; });
            for (const r of batchJson.results as any[]) {
              const fname = r.file_name || nameById[r.file_id] || '';
              if (!r.parse_success) {
                allProducts.push({
                  confidence: 0, product_type: productType, product_code: '',
                  notes: `解析失败: ${fname} - ${r.error || r.parse_errors || '未知错误'}`,
                  _fileName: fname, _failed: true,
                });
                continue;
              }
              if (r.is_assembly && r.parts && r.parts.length > 0) {
                for (const part of r.parts) {
                  allProducts.push(buildRecogDataFromParse(part, productType, '装配体零件', fname + ' / ' + (part.product_name || part.part_id)));
                }
              } else {
                allProducts.push(buildRecogDataFromParse(r, productType, '压缩包解析', fname));
              }
            }
          }
        } catch { /* 批量失败，退回逐个解析 */ }

        if (!usedBatch) {
          setStatusMessage(`批量解析不可用，改为逐个识别（共 ${targetFiles.length} 个）...`);
          for (let fi = 0; fi < targetFiles.length; fi++) {
            const targetFile = targetFiles[fi];
            setStatusMessage(`正在识别 ${fi + 1}/${targetFiles.length}: ${targetFile.name}...`);
            const parseFd = new FormData();
            parseFd.append('file_id', targetFile.file_id);
            const parseResp = await fetch('/api/drawing-parse', {
              method: 'POST',
              body: parseFd,
              headers: { 'x-file-name': encodeURIComponent(targetFile.name) }
            });
            const parseJson = await parseResp.json();
            if (!parseResp.ok || !parseJson.parse_success) {
              allProducts.push({
                confidence: 0,
                product_type: productType,
                product_code: '',
                notes: `解析失败: ${targetFile.name} - ${parseJson.error || '未知错误'}`,
                _fileName: targetFile.name,
                _failed: true,
              });
              continue;
            }
            if (parseJson.is_assembly && parseJson.parts && parseJson.parts.length > 0) {
              for (const part of mergeTopCncIntoParts(parseJson)) {
                allProducts.push(buildRecogDataFromParse(part, productType, '装配体零件', targetFile.name + ' / ' + (part.product_name || part.part_id)));
              }
            } else {
              allProducts.push(buildRecogDataFromParse(parseJson, productType, '压缩包解析', targetFile.name));
            }
          }
        }
        if (allProducts.length === 0) {
          setRecogError('没有成功解析的文件');
          setRecognitionFailed(true);
          return;
        }
        setStatusMessage(null);
        setRecogProducts(allProducts);
        setSelectedProductIdx(0);
        setRecogResult(allProducts[0]);
        setIsAssembly(allProducts.length > 1 || allProducts.some(p => p.is_assembly));
        checkQuota();
        setRecognizing(false);
        commitResult({ recogData: allProducts[0], recogProducts: allProducts, isAssembly: allProducts.length > 1, fileName: file.name, recognitionId: "zip_" + Date.now() });
        return;
      }

      // ===== 3D CAD 图纸解析：走 drawing_parser 服务 =====
      // 注意：DWG 已在上面的 DXF 分支处理（服务端先转 DXF），这里不再包含 .dwg
      const is3DCAD = ['.stp', '.step', '.igs', '.iges', '.x_t'].includes(ext);
      if (is3DCAD) {
        setStatusMessage('3D 模型正在解析...');
        const cadFd = new FormData();
        cadFd.append('file', file);
        const cadResp = await fetch('/api/drawing-parse', { method: 'POST', body: cadFd });
        const cadJson = await cadResp.json();
        if (!cadResp.ok || !cadJson.parse_success) {
          // 后端明确返回「格式不支持」时，直接用它给的可读提示（别再甩 FreeCAD 异常堆栈）
          if (cadJson.error_code === 'unsupported_format' && (cadJson.message || cadJson.hint)) {
            setRecogError(String(cadJson.message || cadJson.hint));
          } else if (ext === '.igs' || ext === '.iges') {
            setRecogError('IGES 格式暂不支持解析。请在 CAD 里把文件另存为 STEP（.stp / .step）后再上传。');
          } else if (ext === '.x_t') {
            // X_T（Parasolid）实测已可解析（2026-10-16）；走到这里说明是该文件自身解析失败，别再误导「格式不支持」
            setRecogError('X_T 解析失败，请确认文件未损坏，或在 CAD 里另存为 STEP（.stp / .step）后重试。');
          } else {
            setRecogError(cadJson.error || cadJson.parse_errors || '3D 模型解析失败');
          }
          setRecognitionFailed(true);
          return;
        }

        // ===== 装配体检测 =====
        if (cadJson.is_assembly && cadJson.parts && cadJson.parts.length > 0) {
          // 装配体：构建零件列表
          setIsAssembly(true);
          // 顶层 CNC 信号下沉：A 把 cnc_total_holes / machining_time_min / cnc_holes 只放在整件顶层，
          // parts[i] 里恒为 0 / 缺失 ⇒ 报价页判定「无 CNC」⇒ 只走锯切，加工费只剩 0.01。
          // 仅当「恰好一个」零件被判 cnc_machined 时才把整件的孔数与工时给它；
          // 多个 cnc_machined 零件则都不下沉（避免同一笔整件工时被重复计到每个零件上）。
          const parts: Record<string, any>[] = mergeTopCncIntoParts(cadJson).map((part: PartInfo) =>
            buildRecogDataFromParse(part, productType, '装配体零件')
          );
          setRecogProducts(parts);
          setSelectedProductIdx(0);
          setRecogResult(parts[0]);
          checkQuota();
          setStatusMessage(null);
          setRecognizing(false);
          commitResult({ recogData: parts[0], recogProducts: parts, isAssembly: true, fileName: file.name, recognitionId: "asm_" + Date.now() });
          launchCheckAsync(file);
          return;
        }

        // 单件模式
        const recogData = buildRecogDataFromParse(cadJson, productType, '3D 模型解析');
        setRecogResult(recogData);
        checkQuota();
        setStatusMessage(null);
        setRecognizing(false);
        const recognitionId = "cad_" + Date.now();
        commitResult({ recogData, recogProducts: [recogData], isAssembly: false, fileName: file.name, recognitionId });
        launchCheckAsync(file);
        return;
      }

      // ===== 图片/PDF AI识别 =====
      setStatusMessage('AI正在识别图纸参数...');
      const fd = new FormData();
      fd.append('file', fileToSend);
      const apiEndpoint = productType === '板材' ? '/api/recognize-sheet' : '/api/recognize-drawing';
      const aiController = new AbortController();
      // 后端 /api/recognize-drawing 的 maxDuration 是 120s；实测豆包视觉单次耗时 86~115s 大幅波动
      // （P1-9：原 110s 会把服务端本可成功的请求掐掉报「识别失败」）——前端设 115s，覆盖实测全部样本，留 5s 给服务端硬上限前的返回
      const aiTimeout = setTimeout(() => aiController.abort(), 115000);
      const resp = await fetch(apiEndpoint + '?userId=' + user!.id, { method: 'POST', body: fd, signal: aiController.signal });
      clearTimeout(aiTimeout);
      const json = await resp.json();
      if (resp.status === 429 || json.quotaExceeded) {
        checkQuota();
        setShowQuotaModal(true);
        return;
      }
      if (resp.status === 401) {
        setShowLoginModal(true);
        return;
      }
      if (!resp.ok || !json.success) {
        setRecogError(json.error || '识别失败');
        setRecognitionFailed(true);
        return;
      }
      const d = json.data || {};
      setRecogResult(d);
      checkQuota();

      // AI返回装配体信息（当前豆包识图一般不会返回，预留支持）
      if (d.is_assembly && d.part_count > 0 && d.parts) {
        setIsAssembly(true);
        const parts = d.parts.map((p: any) => ({ ...p, confidence: d.confidence }));
        setRecogProducts(parts);
        setSelectedProductIdx(0);
        setRecogResult(parts[0]);
        commitResult({ recogData: parts[0], recogProducts: parts, isAssembly: true, recognitionId: "asm_" + Date.now(), fileName: file.name });
      } else {
        const recognitionId = json.recognition_id || ("rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
        // P2-18：低置信度（autoFill=false）时也提交识别数据，不再丢弃成「0 个零件」无入口死路。
        // needs_human / handoff_reason 随数据带上，识别页卡片标「待确认」，用户带参进报价页人工核对。
        // 仅当 data 完全为空（一个字段都没识别出）时才保持 recogData:null。
        const hasData = !!d && Object.keys(d).some(k => d[k] !== null && d[k] !== undefined && d[k] !== '');
        commitResult({ recogData: hasData ? d : null, recognitionId, fileName: file.name });
      }
      setStatusMessage(null);
      setRecognizing(false);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setRecogError('识别超时，请重试或申请深度报价');
      } else {
        setRecogError(e?.message || '网络错误');
      }
      setRecognitionFailed(true);
    } finally {
      setRecognizing(false);
      setStatusMessage(null);
    }
  };
  recognizeFileRef.current = recognizeFile;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    if (isContinuous) {
      const valid = files.filter(isValidFile);
      if (valid.length) {
        queueRef.current = [...queueRef.current, ...valid];
        setPendingQueue(prev => [...prev, ...valid]);
        processNext();
      }
    } else {
      const file = files[0];
      if (isValidFile(file)) {
        setUploadedFile(file);
        recognizeFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (isContinuous) {
      const valid = files.filter(isValidFile);
      if (valid.length) {
        queueRef.current = [...queueRef.current, ...valid];
        setPendingQueue(prev => [...prev, ...valid]);
        processNext();
      }
    } else {
      const file = files[0];
      if (isValidFile(file)) {
        setUploadedFile(file);
        recognizeFile(file);
      }
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    resetRecognitionState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==================== Paste Support ====================
  // 覆盖四类真实粘贴场景，成功/失败都有提示，不静默：
  // ① 截图/复制的图片（items 里 kind=file、image/*，可多张一起粘）
  // ② 从文件夹复制的图纸文件（kind=file，type 常为空/octet-stream，如 .stp/.dxf/.pdf）
  // ③ 从网页/聊天窗口复制的图片（只有 text/html 里的 data:URI，没有文件项）
  // ④ text/plain 是 data:image URL（部分看图软件复制出来的形态）
  useEffect(() => {
    const showHint = (ok: boolean, text: string, ms = 5000) => {
      setPasteHint({ ok, text });
      if (pasteHintTimerRef.current) clearTimeout(pasteHintTimerRef.current);
      pasteHintTimerRef.current = setTimeout(() => setPasteHint(null), ms);
    };
    // 截图在剪贴板里文件名统一是 image.png，多张会重名 → 规范成 pasted_xxx.png
    const normalizeName = (f: File): File => {
      const generic = /^image\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name) || !/\.[a-z0-9]{2,5}$/i.test(f.name);
      if (f.type.startsWith('image/') && generic) {
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        return new File([f], `pasted_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`, { type: f.type });
      }
      return f;
    };
    const feedFiles = (raw: File[], source: string) => {
      const valid: File[] = [];
      let firstBlock: string | null = null;
      for (const f of raw) {
        const err = preflightError(f);
        if (err) { if (!firstBlock) firstBlock = err; continue; }
        if (!isValidFile(f)) {
          if (!firstBlock) firstBlock = `「${f.name}」不是支持的图纸格式（支持 STP/STEP/DXF/DWG/PDF/JPG/PNG/ZIP 等）`;
          continue;
        }
        valid.push(normalizeName(f));
      }
      if (valid.length) {
        if (isContinuous) {
          queueRef.current = [...queueRef.current, ...valid];
          setPendingQueue(prev => [...prev, ...valid]);
          processNextRef.current();
        } else {
          setUploadedFile(valid[0]);
          recognizeFileRef.current(valid[0]);
        }
        showHint(true, `已粘贴 ${valid.length} 个文件（${source}），加入识别队列`);
      } else if (firstBlock) {
        showHint(false, firstBlock);
      } else {
        showHint(false, '剪贴板里没有可识别的图片或图纸文件');
      }
    };
    const dataUriToFile = async (uri: string): Promise<File | null> => {
      try {
        const blob = await (await fetch(uri)).blob();
        if (!blob.size) return null;
        return new File([blob], `pasted_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`, { type: blob.type || 'image/png' });
      } catch { return null; }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      // ①②：文件项（截图图片 / 复制的图纸文件），全部收下
      const files: File[] = [];
      for (const item of Array.from(dt.items || [])) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { feedFiles(files, '剪贴板'); return; }
      // ③：text/html 里的 data:URI 图片
      const html = dt.getData('text/html') || '';
      const m = html.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
      if (m) {
        dataUriToFile(m[1]).then(f => f ? feedFiles([f], '剪贴板图片') : showHint(false, '剪贴板图片解析失败，请另存为文件后再上传'));
        return;
      }
      // ④：text/plain 是 data:image URL
      const text = (dt.getData('text/plain') || '').trim();
      if (/^data:image\//i.test(text)) {
        dataUriToFile(text).then(f => f && feedFiles([f], '剪贴板图片'));
        return;
      }
      // 纯文本等：说清支持什么，但不 preventDefault（输入框照常可粘文字）
      if (text) showHint(false, '剪贴板里没有可识别的图片或图纸（可粘截图，或先在文件夹复制文件再 Ctrl+V）', 4000);
    };
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
      if (pasteHintTimerRef.current) clearTimeout(pasteHintTimerRef.current);
    };
  }, [isContinuous]);

  const requestDeepQuote = async () => {
    if (!uploadedFile || deepQuoteLoading) return;
    setDeepQuoteLoading(true);
    setRecogError(null);
    setStatusMessage('正在进行深度识别，请稍候（可能需要30-60秒）...');
    try {
      let fileToSend = uploadedFile;
      if (uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        setStatusMessage('PDF正在转为图片识别，请稍候...');
        fileToSend = await convertPdfToPng(uploadedFile);
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      fd.append('remark', fileRemark || (recogResult?.handoff_reason as string) || '');
      const resp = await fetch('/api/forward-cad', { method: 'POST', body: fd });
      const text = await resp.text();
      let result: any;
      try { result = JSON.parse(text); } catch { result = { success: false, message: '服务器返回异常: ' + text.substring(0, 200) }; }
      if (result.success && result.autoFill && result.data) {
        setRecogResult(result.data);
        setRecogError(null);
        setStatusMessage(null);
        setUploadedFile(null);
        commitResult({ recogData: result.data });
      } else {
        setRecogError(result.message || result.error || '深度识别完成，已提交工程师人工报价');
      }
    } catch (e: any) {
      setRecogError('深度报价提交失败: ' + (e?.message || '网络错误'));
    } finally {
      setDeepQuoteLoading(false);
      setStatusMessage(null);
      setRecognizing(false);
    }
  };

  return (
    <div style={{ overflow: 'auto', padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📎</span>
        图纸识别
      </div>
      {/* ---- 图纸上传 ---- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
        <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">图纸上传</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : uploadedFile
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            multiple={isContinuous}
            onChange={handleFileSelect}
            className="sr-only"
          />
          {!isContinuous && uploadedFile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <FileText className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{uploadedFile.name}</div>
                  <div className="text-xs text-slate-600">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile(); }}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className={`w-6 h-6 mx-auto mb-1.5 ${dragOver ? 'text-blue-500' : 'text-slate-600'}`} />
              <p className="text-sm text-slate-600">拖拽文件到此处，或<span className="text-blue-500 font-medium">点击上传</span></p>
              <p className="text-xs text-slate-500 mt-1">STEP / DXF / DWG / PDF 均可，AI 自动读尺寸、板厚、孔位</p>
              {/* 支持格式直接摊开给用户看，别等传完才报错 */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                {SUPPORTED_TAGS.map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium leading-none">
                    {t}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowFmtHelp(v => !v); }}
                className="mt-2 text-[11px] text-slate-500 hover:text-blue-600 underline underline-offset-2"
              >
                {showFmtHelp ? '收起格式说明' : '哪些格式不支持？'}
              </button>
              {showFmtHelp && (
                <div className="mt-1.5 text-left rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
                  <div className="font-semibold mb-0.5">暂不支持，传了会失败：</div>
                  <div><b>GZ</b> —— 解压后会丢扩展名，请改用 <b>ZIP</b> / <b>TAR</b> / <b>.tar.gz</b></div>
                  <div><b>IGES</b>（.igs / .iges）—— 暂不支持解析，请在 CAD 里另存为 <b>STEP</b>（.stp / .step）</div>
                  <div className="mt-1 text-amber-700">单文件 ≤4.5MB；DXF / DWG 若图纸没有尺寸标注，会按图形外框估算</div>
                </div>
              )}
              {pasteHint && (
                <div className={`mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium ${pasteHint.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {pasteHint.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{pasteHint.text}</span>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                {isMobileUa
                  ? '微信里点上传后，可选择「聊天记录」里好友发来的文件'
                  : '也可 Ctrl+V 粘贴截图、图片，或先复制图纸文件再 Ctrl+V'}
              </p>
            </div>
          )}
        </div>

        {/* 连续上传模式：队列状态 + 已完成结果 + 去报价按钮 */}
        {isContinuous && (
          <div className="mt-3 space-y-2">
            {uploadedFile && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span className="text-sm text-blue-700 truncate">正在识别：{uploadedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(); }}
                  className="p-1 rounded-full hover:bg-blue-100 transition-colors shrink-0"
                >
                  <X className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            )}
            {pendingQueue.length > 0 && (
              <div className="text-sm text-slate-600 px-1">
                队列中 <b>{pendingQueue.length}</b> 个文件待识别
              </div>
            )}
            {completedResults.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-semibold text-slate-700 px-1">已识别完成</div>
                {/* 零件卡横排：文件名 + 零件数 + 失败原因，窄屏自动换行 */}
                <div className="flex flex-wrap gap-1.5">
                  {completedResults.map((r) => (
                    <div key={r.id} className={`flex-1 min-w-[190px] px-3 py-2 rounded-lg border text-sm ${r.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800 truncate">{r.fileName || '未命名文件'}</span>
                        <span className={`text-xs shrink-0 ${r.error ? 'text-red-600' : isLowConfidencePart(r.products[0]) ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {r.error ? '失败' : `${r.products.length} 个零件${isLowConfidencePart(r.products[0]) ? ' · 待确认' : ''}`}
                        </span>
                      </div>
                      {r.error && <div className="text-xs text-red-600 mt-1">{r.error}</div>}
                      {!r.error && isLowConfidencePart(r.products[0]) && (
                        <div className="text-xs text-amber-600 mt-1">
                          {(r.products[0] && r.products[0].handoff_reason) || '识别置信度不足，参数请人工核对后再使用'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {completedResults.some(r => r.products.length > 0) && (
              <button
                type="button"
                onClick={proceedToQuote}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                去零件列表报价
                <span className="text-blue-100 text-xs">
                  （共 {completedResults.reduce((s, r) => s + r.products.length, 0)} 个零件）
                </span>
              </button>
            )}
          </div>
        )}

        <input
          type="text"
          placeholder="备注说明（可选）"
          value={fileRemark}
          onChange={e => setFileRemark(e.target.value)}
          className="w-full mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
        />

        {/* 识别中 + 进度提示（进度条 + 已用秒数；超 30s 告知图纸较大仍在解析） */}
        {(recognizing || statusMessage) && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="font-semibold shrink-0">AI 解析中（已用 {elapsedSec.toFixed(1)}s）</span>
              {statusMessage && <span className="ml-auto text-xs text-blue-500 truncate max-w-[52%]">{statusMessage}</span>}
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${recogProgress}%` }}
              />
            </div>
            {elapsedSec >= 30 && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                图纸较大，仍在解析，请稍候（通常 1 分钟内完成）
              </div>
            )}
          </div>
        )}

        {/* 识别错误 */}
        {recogError && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-amber-700">{recogError}</div>
              {recognitionFailed && uploadedFile && (
                <button
                  type="button"
                  onClick={requestDeepQuote}
                  disabled={deepQuoteLoading}
                  className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deepQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                  {deepQuoteLoading ? '深度识别中...' : '申请深度报价'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 装配体提示 */}
        {isAssembly && recogProducts.length > 0 && (
          <div className="mt-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">
                检测到装配体，共 {recogProducts.length} 个零件
              </span>
            </div>
            <div className="text-xs text-purple-600 mb-2">
              点击零件切换到对应报价页面，逐个保存后可在报价记录中多选导出汇总单
            </div>
          </div>
        )}

        {/* 零件/产品列表（装配体或ZIP多文件） */}
        {recogProducts.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="text-sm font-semibold text-gray-700">
              {isAssembly ? `装配体零件（${recogProducts.length}个），点击选择报价：` : `共识别 ${recogProducts.length} 个产品，点击切换：`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recogProducts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => switchToProduct(i)}
                  className={`px-2.5 py-1 rounded-md text-sm font-semibold transition-colors border ${
                    selectedProductIdx === i
                      ? 'bg-blue-600 text-white border-blue-600'
                      : p._failed
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p._failed ? '✗' : '✓'} {isAssembly ? (p._partName || p.product_code || `零件${i+1}`) : (p._fileName || `产品${i + 1}`)}
                  {isAssembly && p._quantity > 1 && <span className="ml-1 opacity-70">×{p._quantity}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 识别结果 */}
        {recogResult && !recogError && !recognizing && (
          <div className={`mt-2 rounded-lg border p-2.5 ${
            recogResult.needs_human
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {recogResult.needs_human ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className={`text-sm font-semibold ${
                recogResult.needs_human ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {recogResult.needs_human ? '识别不确定，请确认参数' : (isAssembly ? `已填入零件「${recogResult._partName || recogResult.product_code || '零件'+(selectedProductIdx+1)}」参数` : '已自动填入参数')}
                {typeof recogResult.confidence === 'number' && recogResult.confidence > 0 && (
                  <span className="ml-1 opacity-70">
                    （置信度{(recogResult.confidence*100).toFixed(0)}%
                    {recogResult.confidence < 0.5 && <span className="text-amber-600 font-normal">，建议人工复核</span>}
                    ）
                  </span>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-gray-600">
              {recogResult._isSheetMetal || recogResult.is_sheet_metal ? (
                <>
                  {recogResult.unfold_length != null && <div>展开长: <b>{recogResult.unfold_length}mm</b></div>}
                  {recogResult.unfold_width != null && <div>展开宽: <b>{recogResult.unfold_width}mm</b></div>}
                  {(recogResult.sheet_thickness || recogResult.wall_thickness) != null && <div>板厚: <b>{(recogResult.sheet_thickness || recogResult.wall_thickness)}mm</b></div>}
                  {recogResult.bend_angle != null && <div>折弯角: <b>{recogResult.bend_angle}°</b></div>}
                  {recogResult.bend_radius != null && <div>折弯R: <b>R{recogResult.bend_radius}</b></div>}
                  {(recogResult.unfold_hole_count ?? recogResult.all_holes_total ?? recogResult.cnc_total_holes) != null && <div>孔数: <b>{recogResult.unfold_hole_count ?? recogResult.all_holes_total ?? recogResult.cnc_total_holes}个</b></div>}
                  <div className="col-span-2 text-blue-600 font-medium">📐 钣金折弯件（无需挤压模具）</div>
                </>
              ) : (
                <>
                  {recogResult.width != null && <div>宽: <b>{recogResult.width}mm</b></div>}
                  {recogResult.height != null && <div>高: <b>{recogResult.height}mm</b></div>}
                  {recogResult.wall_thickness != null && <div>壁厚: <b>{recogResult.wall_thickness}mm</b></div>}
                  {recogResult.length != null && <div>长: <b>{recogResult.length}mm</b></div>}
                  {recogResult.perimeter != null && <div>外周长: <b>{recogResult.perimeter}mm</b></div>}
                  {recogResult.inner_perimeter != null && <div>内周长: <b>{recogResult.inner_perimeter}mm</b></div>}
                  {recogResult.meter_weight != null && <div>米重: <b>{recogResult.meter_weight}kg/m</b></div>}
                  {recogResult.crossSectionArea != null && <div>截面积: <b>{recogResult.crossSectionArea}mm²</b></div>}
                  {recogResult.num_cavities != null && <div>模腔数: <b>{recogResult.num_cavities}</b></div>}
                </>
              )}
              {/* 型材但后端没返回截面尺寸：必须显式告知，否则报价页一片空白、用户不知为何算不出价 */}
              {!(recogResult._isSheetMetal || recogResult.is_sheet_metal) &&
                recogResult.crossSectionArea == null && recogResult.width == null && (
                <div className="col-span-2 mt-0.5 rounded px-1.5 py-1 text-xs text-amber-800 bg-amber-100 border border-amber-200">
                  ⚠️ 已判定为<b>型材</b>，但未能提取截面尺寸（宽 / 高 / 外周长 / 截面积）。
                  进入报价页后请手动填写；填了截面积会自动算出米重。
                </div>
              )}
              {isAssembly && recogResult._quantity > 1 && <div>数量: <b>{recogResult._quantity}件</b></div>}
              {recogResult.material_grade ? <div className="col-span-2">材质: <b>{recogResult.material_grade}</b></div> : <div className="col-span-2 text-amber-600">材质: 无法识别，请手动选择</div>}
              {recogResult.surface_treatment ? <div className="col-span-2">表面处理: <b>{recogResult.surface_treatment}</b></div> : <div className="col-span-2 text-amber-600">表面处理: 无法识别，请手动选择</div>}
              {recogResult.product_code && <div className="col-span-2">图号: <b>{recogResult.product_code}</b></div>}
            </div>
            {recogResult.handoff_reason && (
              <div className="mt-1.5 text-xs text-amber-600">{recogResult.handoff_reason}</div>
            )}
            {recogResult.needs_human && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => commitResult({ recogData: recogResult, fileName: recogResult?._fileName || currentFileNameRef.current || uploadedFile?.name })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  确认填入
                </button>
                <button
                  type="button"
                  onClick={requestDeepQuote}
                  disabled={deepQuoteLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deepQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                  {deepQuoteLoading ? '深度识别中...' : '申请深度报价'}
                </button>
              </div>
            )}
            {/* 装配体零件导航提示 */}
            {isAssembly && recogProducts.length > 1 && (
              <div className="mt-2 pt-2 border-t border-purple-200 text-xs text-purple-600">
                💡 提示：保存当前零件报价后，点击上方零件列表切换下一个零件继续报价。所有零件报价保存后，可在「我的报价」中多选导出汇总单。
              </div>
            )}
          </div>
        )}
      </div>
      {/* ===== AI确认对话框（右侧抽屉，不遮挡零件列表） ===== */}
      <Sheet open={showCheckDialog && checkQuestions.length > 0} onOpenChange={(open) => { if (!open) { setShowCheckDialog(false); setCheckQuestions([]); checkTargetIdRef.current = null; } }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 transition-transform duration-300 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0">
          <SheetHeader className="shrink-0 border-b border-blue-100 bg-blue-50/60">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
              <SheetTitle className="text-sm text-blue-800">需要确认以下信息</SheetTitle>
            </div>
            <SheetDescription className="text-xs text-blue-600">填写后点「确认并填入」，参数将自动进入报价表</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {checkQuestions.map((q: any, idx: number) => (
            <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="text-sm text-gray-700 mb-2">{String(q.question || '').replace(/^请+/, '请').replace('请图纸中无法识别材料，选择铝合金牌号', '图纸中未能识别材料，请选择铝合金牌号')}</div>
              {q.input_type === 'select' && (
                <select
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue={q.default || ''}
                  onChange={(e) => {
                    setCheckAnswers(prev => ({ ...prev, [q.field]: e.target.value }));
                  }}
                >
                  {q.options?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {q.input_type === 'number' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    defaultValue={q.default ?? ''}
                    placeholder={q.unit || ''}
                    onChange={(e) => {
                      setCheckAnswers(prev => ({ ...prev, [q.field]: Number(e.target.value) }));
                    }}
                  />
                  {q.unit && <span className="text-sm text-slate-600">{q.unit}</span>}
                </div>
              )}
              {q.input_type === 'confirm' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm rounded-md border transition ${
                      checkAnswers[q.field] === 'yes' || checkAnswers[q.field] === undefined
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setCheckAnswers(prev => ({ ...prev, [q.field]: 'yes' }))}
                  >
                    ✓ 正确
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm rounded-md border transition ${
                      checkAnswers[q.field] === 'no'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setCheckAnswers(prev => ({ ...prev, [q.field]: 'no' }))}
                  >
                    ✗ 需要修改
                  </button>
                </div>
              )}
              {q.input_type === 'text' && (
                <input
                  type="text"
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  defaultValue={q.default || ''}
                  placeholder={q.label || ''}
                  onChange={(e) => {
                    setCheckAnswers(prev => ({ ...prev, [q.field]: e.target.value }));
                  }}
                />
              )}
            </div>
          ))}
          </div>
          <SheetFooter className="shrink-0 border-t border-gray-100 gap-2 sm:flex-row">
            <button
              type="button"
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              onClick={() => {
                const answers = { ...checkAnswers };
                checkQuestions.forEach((q: any) => {
                  if (answers[q.field] === undefined && q.default !== undefined) {
                    answers[q.field] = q.default;
                  }
                });
                const mappedData: Record<string, any> = {};
                if (answers.material_grade) mappedData.material_grade = answers.material_grade;
                if (answers.surface_treatment) {
                  const stMap: Record<string,string> = {
                    '阳极氧化': '氧化', '粉末喷涂': '喷涂', '氟碳喷涂': '喷涂', '木纹转印': '喷涂', '电镀': '无', '无': '无',
                  };
                  mappedData.surface_treatment = stMap[answers.surface_treatment] || answers.surface_treatment;
                }
                if (answers.length_mm) mappedData.length = answers.length_mm;
                commitResult({ recogData: mappedData, checkAnswers: answers, fileName: uploadedFile?.name, patchId: checkTargetIdRef.current || undefined });
                setShowCheckDialog(false);
                setCheckQuestions([]);
                checkTargetIdRef.current = null;
              }}
            >
              确认并填入
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
              onClick={() => { setShowCheckDialog(false); setCheckQuestions([]); checkTargetIdRef.current = null; }}
            >
              跳过
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {/* ===== 登录提示弹窗 ===== */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">登录后使用图纸识别</h3>
              <p className="text-sm text-slate-600 mt-2">注册即送 100 积分，图纸识别自动填入报价表</p>
            </div>
            <div className="flex gap-3">
              <a href="/login" className="flex-1 text-center py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">去登录</a>
              <a href="/register" className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">注册</a>
            </div>
            <button onClick={() => setShowLoginModal(false)} className="w-full text-center text-sm text-slate-600 hover:text-gray-600">取消</button>
          </div>
        </div>
      )}
      {/* ===== 额度超限弹窗 ===== */}
      {showQuotaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">积分不足</h3>
              <p className="text-sm text-slate-600 mt-2">图纸识别每次消耗 10 积分。邀请好友注册，双方各得 100 积分</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  const link = await ensureReferralLink();
                  if (!link) return;
                  try {
                    await navigator.clipboard.writeText(link);
                  } catch {
                    const ta = document.createElement('textarea');
                    ta.value = link;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); } catch { /* ignore */ }
                    document.body.removeChild(ta);
                  }
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                <Share2 className="w-4 h-4" />
                {copiedInvite ? '已复制，去发给好友吧' : '复制邀请链接'}
              </button>
              <button
                onClick={() => {
                  setShowQuotaModal(false);
                  if (!uploadedFile) {
                    setRecogError('请先上传图纸文件，再申请深度报价（工程师人工报价）');
                    return;
                  }
                  requestDeepQuote();
                }}
                className="w-full text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                申请深度报价
              </button>
            </div>
            <button onClick={() => setShowQuotaModal(false)} className="w-full text-center text-sm text-slate-600 hover:text-gray-600">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
