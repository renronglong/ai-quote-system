"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2, AlertTriangle, User, CheckCircle2, Share2, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PRODUCT_TYPES } from './QuoteForm';

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
// CAD扩展名 — 本地解析或转发
const CAD_EXTS = ['.dxf', '.dwg', '.step', '.stp', '.igs'];

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
    material_category: parseJson.material_grade || (isSheet ? '铝板' : ''),
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
    notes: `${source}${fileName ? ': ' + fileName : ''}${isSheet ? ` | 钣金折弯件 ${parseJson.unfold_size || ''} ${parseJson.bend_angle_deg || 90}°/R${parseJson.bend_radius_mm || ''}` : ''} | ⚠️仅用于报价估算，不可作为开模依据`,
    _fileName: fileName,
    _partId: parseJson.part_id || parseJson.part_number || '',
    _quantity: parseJson.quantity || 1,
    _partName: resolvedProductName,
    _isSheetMetal: isSheet,
  };
}

// ==================== Component ====================

export default function DrawingRecognition({ onDrawingData, user }: DrawingRecognitionProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productType, setProductType] = useState('挤出');

  // ===== Helper =====
  const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  // 切换到指定产品（零件/多文件切换）
  const switchToProduct = useCallback((idx: number) => {
    if (idx < 0 || idx >= recogProducts.length) return;
    setSelectedProductIdx(idx);
    const product = recogProducts[idx];
    setRecogResult(product);
    onDrawingData({ recogData: product });
  }, [recogProducts, onDrawingData]);

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

  // PDF文件在浏览器端用pdf.js转为PNG，再发给AI识别
  const convertPdfToPng = async (pdfFile: File): Promise<File> => {
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          (window as any).pdfjsLib = (window as any).pdfjsLib || (window as any).pdfjs;
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          resolve();
        };
        s.onerror = () => reject(new Error('pdf.js加载失败'));
        document.head.appendChild(s);
      });
    }
    const pdfjsLib = (window as any).pdfjsLib;
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

      // ===== DXF 图纸解析：走 drawing_parser 服务 =====
      if (file.name.toLowerCase().endsWith('.dxf')) {
        setStatusMessage('DXF正在解析...');
        const dxfFd = new FormData();
        dxfFd.append('file', file);
        const dxfResp = await fetch('/api/drawing-parse', { method: 'POST', body: dxfFd });
        const dxfJson = await dxfResp.json();
        if (!dxfResp.ok || !dxfJson.parse_success) {
          setRecogError(dxfJson.error || dxfJson.parse_errors || 'DXF解析失败');
          setRecognitionFailed(true);
          return;
        }
        // 从 dimensions 计算展开尺寸
        const dims = dxfJson.drawing_dimensions || [];
        const hDims = dims.filter((d: any) => d.direction === '水平').map((d: any) => d.measurement_mm);
        const vDims = dims.filter((d: any) => d.direction === '垂直').map((d: any) => d.measurement_mm);
        const maxH = hDims.length ? Math.max(...hDims) : 0;
        const maxV = vDims.length ? Math.max(...vDims) : 0;
        const vCount: Record<number, number> = {};
        vDims.forEach((v: number) => { const k = Math.round(v * 10); vCount[k] = (vCount[k] || 0) + 1; });
        const bodyH = Math.max(...Object.entries(vCount).filter(([, c]) => c >= 2).map(([k]) => Number(k) / 10), 0);
        const bendExt = vDims.filter((v: number) => Math.abs(v - bodyH) > bodyH * 0.3 && Math.abs(v - maxV) < 1);
        const bendVal = bendExt.length ? Math.max(...bendExt) : 0;
        const unfoldL = maxH > 0 ? Math.round((maxH + bendVal) * 100) / 100 : maxH;
        const unfoldW = maxV;
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
          notes: `DXF解析 | 展开${unfoldL}×${unfoldW}mm | 孔: ${holeDesc || '无'} | ⚠️仅用于报价估算，不可作为开模依据`,
        };
        setRecogResult(recogData);
        checkQuota();
        setStatusMessage(null);
        setRecognizing(false);
        onDrawingData({ recogData, recognitionId: "dxf_" + Date.now() });
        return;
      }

      // ===== ZIP 压缩包：解压后遍历所有图纸文件 =====
      const isZip = ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);
      if (isZip) {
        setStatusMessage('压缩包正在解压...');
        const zipFd = new FormData();
        zipFd.append('file', file);
        const zipResp = await fetch('/api/extract', { method: 'POST', body: zipFd });
        const zipJson = await zipResp.json();
        if (!zipResp.ok || !zipJson.success) {
          setRecogError(zipJson.error || '压缩包解压失败');
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
        setStatusMessage(`解压成功，共 ${targetFiles.length} 个文件，正在逐个识别...`);
        const allProducts: Record<string, any>[] = [];
        for (let fi = 0; fi < targetFiles.length; fi++) {
          const targetFile = targetFiles[fi];
          setStatusMessage(`正在识别 ${fi + 1}/${targetFiles.length}: ${targetFile.name}...`);
          if (fi === 0) {
            try {
              const clsFd = new FormData();
              clsFd.append('file_id', targetFile.file_id);
              const clsResp = await fetch('/api/classify', { method: 'POST', body: clsFd });
              if (clsResp.ok) {
                const classifyData = await clsResp.json();
                const mapped = processToProductType[classifyData.process_type_cn];
                if (mapped && PRODUCT_TYPES[mapped] && mapped !== productType) {
                  setProductType(mapped);
                }
              }
            } catch { /* 分类失败忽略 */ }
          }
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
          // 检查压缩包内是否有装配体
          if (parseJson.is_assembly && parseJson.parts && parseJson.parts.length > 0) {
            // 装配体：展开零件加入列表
            for (const part of parseJson.parts) {
              const partData = buildRecogDataFromParse(part, productType, '装配体零件', targetFile.name + ' / ' + (part.product_name || part.part_id));
              allProducts.push(partData);
            }
          } else {
            const recogData = buildRecogDataFromParse(parseJson, productType, '压缩包解析', targetFile.name);
            allProducts.push(recogData);
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
        onDrawingData({ recogData: allProducts[0], recogProducts: allProducts, isAssembly: allProducts.length > 1, fileName: file.name, recognitionId: "zip_" + Date.now() });
        return;
      }

      // ===== 3D CAD 图纸解析：走 drawing_parser 服务 =====
      const is3DCAD = ['.stp', '.step', '.igs', '.iges', '.x_t', '.dwg'].includes(ext);
      if (is3DCAD) {
        setStatusMessage('3D 模型正在解析...');
        const cadFd = new FormData();
        cadFd.append('file', file);
        const cadResp = await fetch('/api/drawing-parse', { method: 'POST', body: cadFd });
        const cadJson = await cadResp.json();
        if (!cadResp.ok || !cadJson.parse_success) {
          setRecogError(cadJson.error || cadJson.parse_errors || '3D 模型解析失败');
          setRecognitionFailed(true);
          return;
        }

        // ===== 装配体检测 =====
        if (cadJson.is_assembly && cadJson.parts && cadJson.parts.length > 0) {
          // 装配体：构建零件列表
          setIsAssembly(true);
          const parts: Record<string, any>[] = cadJson.parts.map((part: PartInfo) =>
            buildRecogDataFromParse(part, productType, '装配体零件')
          );
          setRecogProducts(parts);
          setSelectedProductIdx(0);
          setRecogResult(parts[0]);
          checkQuota();
          setStatusMessage(null);
          setRecognizing(false);
          onDrawingData({ recogData: parts[0], recogProducts: parts, isAssembly: true, fileName: file.name, recognitionId: "asm_" + Date.now() });
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
        onDrawingData({ recogData, recogProducts: [recogData], isAssembly: false, fileName: file.name, recognitionId });
        launchCheckAsync(file);
        return;
      }

      // ===== 图片/PDF AI识别 =====
      setStatusMessage('AI正在识别图纸参数...');
      const fd = new FormData();
      fd.append('file', fileToSend);
      const apiEndpoint = productType === '板材' ? '/api/recognize-sheet' : '/api/recognize-drawing';
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), 60000);
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
        onDrawingData({ recogData: parts[0], recognitionId: "asm_" + Date.now() });
      } else {
        const recognitionId = json.recognition_id || ("rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
        if (json.autoFill && d.confidence >= 0.75) {
          onDrawingData({ recogData: d, recognitionId });
        } else {
          onDrawingData({ recogData: null, recognitionId });
        }
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
      recognizeFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
      recognizeFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    resetRecognitionState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==================== Paste Support ====================
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase() || '.png';
            if (ALLOWED_EXTENSIONS.includes(ext) || ext === '.png') {
              const namedFile = new File([file], `pasted_${Date.now()}.png`, { type: file.type });
              setUploadedFile(namedFile);
              recognizeFile(namedFile);
            }
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

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
        onDrawingData({ recogData: result.data });
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
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploadedFile ? (
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
              <p className="text-xs text-slate-600 mt-1">支持 PDF、JPG、PNG、DXF、DWG、STP、STEP、IGS、X_T、ZIP、RAR、7Z 等，也可 Ctrl+V 粘贴图片</p>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="备注说明（可选）"
          value={fileRemark}
          onChange={e => setFileRemark(e.target.value)}
          className="w-full mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
        />

        {/* 识别中 + 进度提示 */}
        {(recognizing || statusMessage) && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{statusMessage || '处理中...'}</span>
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
                  {(recogResult.all_holes_total || recogResult.cnc_total_holes) != null && <div>孔数: <b>{recogResult.all_holes_total || recogResult.cnc_total_holes}个</b></div>}
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
                  onClick={() => onDrawingData({ recogData: recogResult })}
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
      {/* ===== AI确认对话框 ===== */}
      {showCheckDialog && checkQuestions.length > 0 && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <span className="text-sm font-semibold text-blue-800">需要确认以下信息</span>
          </div>
          {checkQuestions.map((q: any, idx: number) => (
            <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="text-sm text-gray-700 mb-2">{String(q.question || '').replace(/^请+/, '请')}</div>
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
          <div className="flex gap-2 pt-1">
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
                onDrawingData({ recogData: mappedData, checkAnswers: answers });
                setShowCheckDialog(false);
                setCheckQuestions([]);
              }}
            >
              确认并填入
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
              onClick={() => { setShowCheckDialog(false); setCheckQuestions([]); }}
            >
              跳过
            </button>
          </div>
        </div>
      )}
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
