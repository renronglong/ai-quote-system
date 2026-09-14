"use client";
import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, X, Loader2, AlertTriangle, User, CheckCircle2, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PRODUCT_TYPES } from './QuoteForm';

// ==================== Types ====================

interface DrawingRecognitionProps {
  onDrawingData: (data: {
    recogData: Record<string, any> | null;
    recognitionId?: string;
    checkAnswers?: Record<string, any>;
  }) => void;
  user: any;
  aiData: any;
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
  const [recogResult, setRecogResult] = useState<Record<string, any> | null>(null);
  const [recogProducts, setRecogProducts] = useState<Record<string, any>[]>([]);
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [recogError, setRecogError] = useState<string | null>(null);
  const [checkQuestions, setCheckQuestions] = useState<any[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, any>>({});
  const [showCheckDialog, setShowCheckDialog] = useState(false);
  const [deepQuoteLoading, setDeepQuoteLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productType, setProductType] = useState('挤出');

  // ===== Helper =====
  const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  // 切换到指定产品（从 recogProducts 数组中加载）
  const switchToProduct = (idx: number) => {
    if (idx < 0 || idx >= recogProducts.length) return;
    setSelectedProductIdx(idx);
    setRecogResult(recogProducts[idx]);
    onDrawingData({ recogData: recogProducts[idx] });
  };

  // PDF文件在浏览器端用pdf.js转为PNG，再发给AI识别
  const convertPdfToPng = async (pdfFile: File): Promise<File> => {
    // 动态加载pdf.js（CDN，禁用Worker避免CORS）
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

    // ===== 自动工艺分类 =====
    const classifyFd = new FormData();
    classifyFd.append('file', file);
    try {
      setRecogError('正在识别工艺类型...');
      const classifyResp = await fetch('/api/classify', { method: 'POST', body: classifyFd });
      console.log('[自动分类] API响应状态:', classifyResp.status);
      if (classifyResp.ok) {
        const classifyResult = await classifyResp.json();
        console.log('[自动分类] API返回数据:', classifyResult);
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
    setRecogError(null);

    setRecognizing(true);
    setRecogError(null);
    setRecogResult(null);
    setRecogProducts([]);
    setSelectedProductIdx(0);
    try {
      let fileToSend = file;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setRecogError('PDF正在转为图片识别...');
        fileToSend = await convertPdfToPng(file);
        setRecogError(null);
      }
      // ===== DXF 图纸解析：走 drawing_parser 服务 =====
      if (file.name.toLowerCase().endsWith('.dxf')) {
        setRecogError('DXF正在解析...');
        const dxfFd = new FormData();
        dxfFd.append('file', file);
        const dxfResp = await fetch('/api/drawing-parse', { method: 'POST', body: dxfFd });
        const dxfJson = await dxfResp.json();
        setRecogError(null);
        if (!dxfResp.ok || !dxfJson.parse_success) {
          setRecogError(dxfJson.error || dxfJson.parse_errors || 'DXF解析失败');
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
          confidence: 0.95,
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
        onDrawingData({ recogData, recognitionId: "dxf_" + Date.now() });
        return;
      }
      // ===== ZIP 压缩包：解压后遍历所有图纸文件 =====
      const isZip = ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);
      if (isZip) {
        setRecogError('压缩包正在解压...');
        const zipFd = new FormData();
        zipFd.append('file', file);
        const zipResp = await fetch('/api/extract', { method: 'POST', body: zipFd });
        const zipJson = await zipResp.json();
        if (!zipResp.ok || !zipJson.success) {
          setRecogError(zipJson.error || '压缩包解压失败');
          return;
        }
        const files = zipJson.files || [];
        if (files.length === 0) {
          setRecogError('压缩包中没有可识别的文件');
          return;
        }
        const DRAWABLE_EXTS = ['.stp', '.step', '.igs', '.iges', '.x_t', '.dwg', '.dxf', '.pdf'];
        const targetFiles = files.filter((f: any) => DRAWABLE_EXTS.includes('.' + f.name.split('.').pop()?.toLowerCase()));
        if (targetFiles.length === 0) {
          setRecogError('压缩包中没有支持的图纸格式(STP/DXF/DWG/PDF)');
          return;
        }
        setRecogError(`解压成功，共 ${targetFiles.length} 个文件，正在逐个识别...`);
        const allProducts: Record<string, any>[] = [];
        for (let fi = 0; fi < targetFiles.length; fi++) {
          const targetFile = targetFiles[fi];
          setRecogError(`正在识别 ${fi + 1}/${targetFiles.length}: ${targetFile.name}...`);
          if (fi === 0) {
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
          const recogData: Record<string, any> = {
            confidence: 0.9,
            product_type: productType,
            product_code: parseJson.product_code || '',
            surface_treatment: parseJson.surface_treatment || '',
            material_grade: parseJson.material_grade || '',
            width: parseJson.section_width_mm,
            height: parseJson.section_height_mm,
            perimeter: parseJson.outer_perimeter_mm,
            inner_perimeter: parseJson.inner_perimeter_mm,
            meter_weight: parseJson.weight_kg_per_m,
            wall_thickness: parseJson.wall_thickness_mm,
            crossSectionArea: parseJson.section_area_mm2,
            die_type: (() => {
              const raw = String(parseJson.die_type || parseJson.mold_type || '').toLowerCase();
              if (['split', '分流模', '中空', '空心'].some(v => raw.includes(v))) return 'split';
              if (['flat', '平模', '实心'].some(v => raw.includes(v))) return 'flat';
              return parseJson.die_type || parseJson.mold_type || '';
            })(),
            num_cavities: parseJson.is_hollow ? 1 : 0,
            material_category: parseJson.material_grade || '',
            length: parseJson.extrusion_length_mm,
            process: parseJson.process || null,
            secondary_operations: parseJson.secondary_operations || null,
            notes: `压缩包解析: ${targetFile.name} | ⚠️仅用于报价估算，不可作为开模依据`,
            _fileName: targetFile.name,
          };
          allProducts.push(recogData);
        }
        setRecogError(null);
        setRecogProducts(allProducts);
        setSelectedProductIdx(0);
        setRecogResult(allProducts[0]);
        checkQuota();
        onDrawingData({ recogData: allProducts[0], recognitionId: "zip_" + Date.now() });
        return;
      }

      // ===== 3D CAD 图纸解析：走 drawing_parser 服务 =====
      const is3DCAD = ['.stp', '.step', '.igs', '.iges', '.x_t', '.dwg'].includes(ext);
      if (is3DCAD) {
        setRecogError('3D 模型正在解析...');
        const cadFd = new FormData();
        cadFd.append('file', file);
        const cadResp = await fetch('/api/drawing-parse', { method: 'POST', body: cadFd });
        const cadJson = await cadResp.json();
        setRecogError(null);
        if (!cadResp.ok || !cadJson.parse_success) {
          setRecogError(cadJson.error || cadJson.parse_errors || '3D 模型解析失败');
          return;
        }
        const recogData: Record<string, any> = {
          confidence: 0.9,
          product_type: productType,
          product_code: cadJson.product_code || '',
          surface_treatment: cadJson.surface_treatment || '',
          material_grade: cadJson.material_grade || '',
          width: cadJson.section_width_mm,
          height: cadJson.section_height_mm,
          perimeter: cadJson.outer_perimeter_mm,
          inner_perimeter: cadJson.inner_perimeter_mm,
          meter_weight: cadJson.weight_kg_per_m,
          wall_thickness: cadJson.wall_thickness_mm,
          crossSectionArea: cadJson.section_area_mm2,
          die_type: (() => {
            const raw = String(cadJson.die_type || cadJson.mold_type || '').toLowerCase();
            if (['split', '分流模', '中空', '空心'].some(v => raw.includes(v))) return 'split';
            if (['flat', '平模', '实心'].some(v => raw.includes(v))) return 'flat';
            return cadJson.die_type || cadJson.mold_type || '';
          })(),
          num_cavities: cadJson.is_hollow ? 1 : 0,
          material_category: cadJson.material_grade || '',
          length: cadJson.extrusion_length_mm,
          process: cadJson.process || null,
          secondary_operations: cadJson.secondary_operations || null,
          cnc_holes: cadJson.cnc_holes || null,
          cnc_total_holes: cadJson.cnc_total_holes || 0,
          machining_time_min: cadJson.machining_time_min || null,
          notes: `3D 模型解析 | ⚠️仅用于报价估算，不可作为开模依据`,
        };
        setRecogResult(recogData);
        checkQuota();
        const recognitionId = "cad_" + Date.now();
        onDrawingData({ recogData, recognitionId });
        // 调用完整性检查，获取需要用户确认的问题
        const checkFd = new FormData();
        checkFd.append('file', file);
        try {
          const checkResp = await fetch('/api/check', { method: 'POST', body: checkFd });
          if (checkResp.ok) {
            const checkData = await checkResp.json();
            if (checkData.success && checkData.questions && checkData.questions.length > 0) {
              setCheckQuestions(checkData.questions);
              setCheckAnswers({});
              setShowCheckDialog(true);
            }
          }
        } catch(e) { /* 检查失败不影响主流程 */ }
        return;
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      // 根据产品类型路由到不同的识别API：板材用独立API
      const apiEndpoint = productType === '板材' ? '/api/recognize-sheet' : '/api/recognize-drawing';
      const resp = await fetch(apiEndpoint + '?userId=' + user!.id, { method: 'POST', body: fd });
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
        return;
      }
      const d = json.data || {};
      setRecogResult(d);
      checkQuota();
      const recognitionId = json.recognition_id || ("rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
      if (json.autoFill && d.confidence >= 0.75) {
        onDrawingData({ recogData: d, recognitionId });
      } else {
        onDrawingData({ recogData: null, recognitionId });
      }
    } catch (e: any) {
      setRecogError(e?.message || '网络错误');
    } finally {
      setRecognizing(false);
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
    setRecogResult(null);
    setRecogProducts([]);
    setSelectedProductIdx(0);
    setRecogError(null);
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
    setRecogError('正在进行深度识别，请稍候（可能需要30-60秒）...');
    try {
      let fileToSend = uploadedFile;
      if (uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        setRecogError('PDF正在转为图片识别，请稍候...');
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
        setUploadedFile(null);
        onDrawingData({ recogData: result.data });
      } else {
        setRecogError(result.message || result.error || '深度识别完成，已提交工程师人工报价');
      }
    } catch (e: any) {
      setRecogError('深度报价提交失败: ' + (e?.message || '网络错误'));
    } finally {
      setDeepQuoteLoading(false);
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
        <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">图纸上传（可选）</label>
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

        {/* 识别中 */}
        {recognizing && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在AI识别图纸参数...
          </div>
        )}

        {/* 识别错误 */}
        {recogError && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-amber-700">{recogError}</div>
              {uploadedFile && (
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

        {/* 多产品列表 */}
        {recogProducts.length > 1 && (
          <div className="mt-2 space-y-1.5">
            <div className="text-sm font-semibold text-gray-700">共识别 {recogProducts.length} 个产品，点击切换：</div>
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
                  {p._failed ? '' : '✓'} {p._fileName || `产品${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 识别结果 */}
        {recogResult && !recogError && (
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
                {recogResult.needs_human ? '识别不确定，请确认参数' : 'AI已自动填入参数'}
                {typeof recogResult.confidence === 'number' && (
                  <span className="ml-1 opacity-70">（置信度{(recogResult.confidence*100).toFixed(0)}%）</span>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-gray-600">
              {recogResult.width != null && <div>宽: <b>{recogResult.width}mm</b></div>}
              {recogResult.height != null && <div>高: <b>{recogResult.height}mm</b></div>}
              {recogResult.wall_thickness != null && <div>壁厚: <b>{recogResult.wall_thickness}mm</b></div>}
              {recogResult.length != null && <div>长: <b>{recogResult.length}mm</b></div>}
              {recogResult.perimeter != null && <div>外周长: <b>{recogResult.perimeter}mm</b></div>}
              {recogResult.inner_perimeter != null && <div>内周长: <b>{recogResult.inner_perimeter}mm</b></div>}
              {recogResult.meter_weight != null && <div>米重: <b>{recogResult.meter_weight}kg/m</b></div>}
              {recogResult.section_area_mm2 != null && <div>面域: <b>{recogResult.section_area_mm2}mm²</b></div>}
              {recogResult.num_cavities != null && <div>模腔数: <b>{recogResult.num_cavities}</b></div>}
              {recogResult.material_grade ? <div className="col-span-2">材质: <b>{recogResult.material_grade}</b></div> : <div className="col-span-2 text-amber-600">材质: 无法识别，请手动选择</div>}
              {recogResult.surface_treatment ? <div className="col-span-2">表面处理: <b>{recogResult.surface_treatment}</b></div> : <div className="col-span-2 text-amber-600">表面处理: 无法识别，请手动选择</div>}
              {recogResult.product_code && <div className="col-span-2">图号: <b>{recogResult.product_code}</b></div>}
            </div>
            {recogResult.handoff_reason && (
              <div className="mt-1.5 text-xs text-amber-600">{recogResult.handoff_reason}</div>
            )}
            <div className="mt-2 flex gap-2">
              {recogResult.needs_human && (
                <>
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
                </>
              )}
            </div>
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
              <div className="text-sm text-gray-700 mb-2">{q.question}</div>
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
                // Map check answers to form data and send via onDrawingData
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
