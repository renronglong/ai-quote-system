"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileImage, ShieldAlert, ExternalLink, Info, Box } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { calculatePrice } from '@/lib/pricing/engine';
import type { PricingResult } from '@/lib/pricing/types';

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

// 业主 2026-11-13（意图 D）：原「字段对照表 / 一句话看懂 / 原始 JSON」原始转储已替换为「基本信息」卡片（见 buildBasicInfo）。

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

type BasicInfo = {
  name: string;
  productType: 'extrusion' | 'plate' | 'die_casting';
  processLabel: string;
  isSheet?: boolean;
  w?: number; h?: number; len?: number; thick?: number; area?: number;
  cd?: number; mw?: number; wg?: number; conf?: number | string;
  mold: string;
  costTip: string;
  price: { ok: boolean; result?: PricingResult; reason?: string };
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
 * 业主 2026-11-13（意图 D）：从后端识别响应里抽取「基本信息」+ 用站点报价引擎算「价格预估」。
 * 价格用识别尺寸 + 默认参数（1 件、无表面处理、引擎默认铝价）即时估算，与 /quote 正式报价会有差异。
 */
function buildBasicInfo(raw: any): BasicInfo {
  const r = raw && typeof raw === 'object' ? raw : {};
  const name = r.product_name || r.part_name || r.file_name || r.drawing_number || '';
  const isSheet = r.is_sheet_metal === true ? true : r.is_sheet_metal === false ? false : undefined;
  const procRaw = String(r.process_type || r.product_type || '');
  const isCast = /die_cast|压铸|casting/i.test(procRaw);
  const isPlate = isSheet || /sheet|板材|钣金/i.test(procRaw);
  const productType: BasicInfo['productType'] = isPlate ? 'plate' : isCast ? 'die_casting' : 'extrusion';
  const processLabel = isPlate ? '钣金 / 板材' : isCast ? '压铸' : '挤压型材';

  const w = numFrom(r, 'section_width_mm', 'width_mm', 'width');
  const h = numFrom(r, 'section_height_mm', 'height_mm', 'height');
  const len = numFrom(r, 'extrusion_length_mm', 'length_mm', 'length');
  const thick = numFrom(r, 'material_thickness_mm', 'wall_thickness_mm', 'thickness_mm', 'thickness');
  const area = numFrom(r, 'section_area_mm2', 'cross_section_area_mm2');
  const cd = numFrom(r, 'circumscribed_diameter_mm', 'section_min_circle_diameter_mm');
  const mw = numFrom(r, 'weight_kg_per_m', 'meter_weight');
  const wg = numFrom(r, 'weight_g');
  const conf = r.confidence_score ?? r.confidence;
  const mold = r.mold_type || r.die_type || '';

  let price: BasicInfo['price'] = { ok: false };
  try {
    if (productType === 'extrusion') {
      if (!(area && area > 0)) price = { ok: false, reason: '缺少截面面积' };
      else if (!(len && len > 0)) price = { ok: false, reason: '缺少型材长度' };
      else if (len > 3100) price = { ok: false, reason: '长度超出单支料长 3100mm，请到 /quote 按实际长度报价' };
      else price = { ok: true, result: calculatePrice({ productType: 'extrusion', crossSectionArea: area, length: len, quantity: 1, surfaceTreatment: '无' }) };
    } else if (productType === 'plate') {
      if (w && w > 0 && h && h > 0 && thick && thick > 0) {
        price = { ok: true, result: calculatePrice({ productType: 'plate', width: w, height: h, thickness: thick, quantity: 1, surfaceTreatment: '无' }) };
      } else price = { ok: false, reason: '缺少宽 / 高 / 板厚' };
    } else {
      const kg = wg != null ? wg / 1000 : undefined;
      if (kg && kg > 0) {
        price = { ok: true, result: calculatePrice({ productType: 'die_casting', weight: kg, quantity: 1, surfaceTreatment: '无' }) };
      } else price = { ok: false, reason: '缺少单件重量' };
    }
  } catch {
    price = { ok: false, reason: '计算异常' };
  }

  const costTip = (r.classification && r.classification.cost_tip) || '';
  return { name, productType, processLabel, isSheet, w, h, len, thick, area, cd, mw, wg, conf, mold, costTip, price };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-800 break-words">{value}</dd>
    </div>
  );
}

function PriceBlock({ result, productType }: { result: PricingResult; productType: BasicInfo['productType'] }) {
  const unit = productType === 'extrusion' ? (result.unitPriceWithTax ?? result.unitCost) : result.unitCost;
  const processing = productType === 'extrusion'
    ? (result.processingFeeCost ?? result.cncCost)
    : (result.extrusionCost + result.cncCost);
  const weight = result.netWeight != null ? result.netWeight : undefined;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-sm">
      <InfoRow label="预估单价(含税)" value={`¥${(unit ?? 0).toFixed(2)}`} />
      <InfoRow label="材料费" value={`¥${(result.materialCost ?? 0).toFixed(2)}`} />
      <InfoRow label="加工费" value={`¥${(processing ?? 0).toFixed(2)}`} />
      <InfoRow label="表面处理费" value={result.surfaceTreatmentCost ? `¥${result.surfaceTreatmentCost.toFixed(2)}` : '无'} />
      {weight != null ? <InfoRow label="单件重(估)" value={`${weight.toFixed(4)} kg`} /> : null}
      <InfoRow label="铝价" value={`¥${(result.aluminumPrice?.pricePerKg ?? 0).toFixed(2)}/kg`} />
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
  const [showJson, setShowJson] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // 区分两种空态：①本会话压根没上传过图纸（ai_quote_parts / ai_quote_recog_result 皆空）；
  // ②上传过、后端也认，只是后端没给 drawing_preview_url 字段。
  const [hasSessionData, setHasSessionData] = useState(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const i = Math.max(0, Number(q.get('i') || 0) || 0);
      setIdx(i);
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

  const drawings = useMemo(() => findDrawingSources(raw), [raw]);
  // 业主 2026-11-13（意图 D）：用「基本信息」卡片替换原「后端全部信息」原始转储。
  // 价格采用站点自带报价引擎，基于识别尺寸 + 默认参数（1 件、无表面处理、引擎默认铝价）实时估算，标注「预估」。
  const basicInfo = useMemo(() => buildBasicInfo(raw), [raw]);

  return (
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

        {/* ② 基本信息（管理员专属，含价格预估） */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-2 mb-3">
            <ShieldAlert size={18} className="text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-medium">基本信息（管理员）</h2>
              <p className="text-xs text-slate-500 mt-0.5">零件识别结果的关键信息与价格预估，供管理员核对。普通用户不可见。</p>
            </div>
          </div>

          {authLoading ? (
            <div className="text-sm text-slate-400 py-4">检查权限中…</div>
          ) : !isAdmin ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              仅管理员可查看零件基本信息。普通用户看到的图纸区不受影响。
            </div>
          ) : (
            <div className="space-y-5">
              {/* 基本信息：识别信息 */}
              <div>
                <div className="text-sm font-medium mb-2">识别信息</div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
                  <InfoRow label="产品名称" value={basicInfo.name || '—'} />
                  <InfoRow label="工艺类型" value={basicInfo.processLabel} />
                  <InfoRow label="截面尺寸" value={(basicInfo.w != null || basicInfo.h != null) ? `宽 ${basicInfo.w ?? '—'} × 高 ${basicInfo.h ?? '—'} mm` : '—'} />
                  <InfoRow label="型材长度" value={basicInfo.len != null ? `${basicInfo.len} mm` : '—'} />
                  <InfoRow label="壁厚" value={basicInfo.thick != null ? `${basicInfo.thick} mm` : '—'} />
                  <InfoRow label="截面积" value={basicInfo.area != null ? `${basicInfo.area} mm²` : '—'} />
                  <InfoRow label="每米重" value={basicInfo.mw != null ? `${basicInfo.mw} kg/m` : '—'} />
                  <InfoRow label="单件重" value={basicInfo.wg != null ? `${basicInfo.wg} g` : '—'} />
                  <InfoRow label="外接圆直径" value={basicInfo.cd != null ? `${basicInfo.cd} mm` : '—'} />
                  <InfoRow label="识别置信度" value={basicInfo.conf != null ? String(basicInfo.conf) : '—'} />
                  <InfoRow label="是否钣金件" value={basicInfo.isSheet === true ? '是' : basicInfo.isSheet === false ? '否' : '—'} />
                  <InfoRow label="建议模具类型" value={basicInfo.mold || '—'} />
                </dl>
              </div>

              {/* 价格（预估） */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-medium">价格（预估）</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">基于识别尺寸 · 1 件 · 无表面处理</span>
                </div>
                {basicInfo.price.ok && basicInfo.price.result ? (
                  <PriceBlock result={basicInfo.price.result} productType={basicInfo.productType} />
                ) : (
                  <div className="text-sm text-slate-500">暂无法估算：{basicInfo.price.reason}。</div>
                )}
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  注：此为前端按识别尺寸即时估算（铝价取引擎默认 ¥23.53/kg），与 /quote 正式报价因长度、数量、表面处理、实时铝价不同会有差异，仅供参考。
                </p>
              </div>

              {/* 后端成本提示 */}
              {basicInfo.costTip ? (
                <div>
                  <div className="text-sm font-medium mb-1">后端成本提示</div>
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">{basicInfo.costTip}</p>
                </div>
              ) : null}

              {/* 原始 JSON（调试） */}
              <div>
                <button onClick={() => setShowJson(v => !v)} className="text-sm text-blue-600 hover:underline">
                  {showJson ? '收起' : '展开'}原始 JSON（调试用）
                </button>
                {showJson && (
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 text-slate-100 text-xs p-4 whitespace-pre-wrap break-all">
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-slate-400 mt-4 text-center">
          数据来源：本次图纸识别的后端原始响应（保存在当前浏览器会话中）
        </p>
      </div>
    </div>
  );
}
