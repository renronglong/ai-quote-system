"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Layers, CheckCircle2,
  ChevronRight, ArrowRight, Package, Ruler, Box, Info, AlertCircle, Loader2, X
} from 'lucide-react';
import TopNavLinks from '@/components/TopNav';

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

export default function QuotePartsPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<PartsPayload | null>(null);
  const [quotedParts, setQuotedParts] = useState<Set<number>>(new Set());
  // ⚠️ 选项必须能被报价页映射成合法材料大类：
  //   板材类目 = 铝板 / 冷轧板 / 钢板 / 不锈钢 / 镀锌板（见 PRODUCT_TYPES['板材'].materialCategories）
  //   铝板这一项用牌号细化（6063/6061/5052/6060/未指定），其余直接给类目名。
  //   「钢」不是合法类目（10-09 已改为「钢板」）；旧数据里的「钢」由 normalizeSheetCategory 兜底。
  const MATERIAL_OPTIONS = ['6063', '6061', '5052', '6060', '铝（未指定）', '钢板', '冷轧板', '镀锌板', '不锈钢'];
  const [currentMaterial, setCurrentMaterial] = useState<string>('');
  const [materialModalIdx, setMaterialModalIdx] = useState<number | null>(null); // 哪个零件弹出选材料

  // 初始化材料选择：从 payload 读取，没有则留空
  useEffect(() => {
    if (!payload) return;
    const payloadMat = (payload as any)?.material || '';
    setCurrentMaterial(payloadMat);
  }, [payload]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_quote_parts');
      if (!raw) { router.push('/quote/recognize'); return; }
      const data: PartsPayload = JSON.parse(raw);
      setPayload(data);
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
    const effectiveMaterial = part.material_grade || currentMaterial;
    if (!effectiveMaterial) {
      // 弹出材料选择弹窗
      setMaterialModalIdx(idx);
      return;
    }
    navigateToQuote(idx, effectiveMaterial);
  };

  const navigateToQuote = (idx: number, material: string) => {
    const part = payload!.products[idx];
    const partToStore = { ...part, material_grade: material };
    sessionStorage.setItem('ai_quote_selected_idx', String(idx));
    sessionStorage.setItem('ai_quote_selected_part', JSON.stringify(partToStore));
    router.push('/quote?from=parts');
  };

  const handleModalMaterialSelect = (material: string) => {
    if (materialModalIdx === null || !payload) return;
    // 更新该零件的材料并跳转
    const updatedProducts = [...payload.products];
    updatedProducts[materialModalIdx] = { ...updatedProducts[materialModalIdx], material_grade: material };
    const updatedPayload = { ...payload, products: updatedProducts };
    sessionStorage.setItem('ai_quote_parts', JSON.stringify(updatedPayload));
    setPayload(updatedPayload);
    setMaterialModalIdx(null);
    navigateToQuote(materialModalIdx, material);
  };

  // 材料变更时同步到 payload 并写回 sessionStorage
  const handleMaterialChange = (newMat: string) => {
    setCurrentMaterial(newMat);
    if (payload) {
      const updated = { ...(payload as any), material: newMat };
      sessionStorage.setItem('ai_quote_parts', JSON.stringify(updated));
    }
    // 同步 localStorage 默认材料
    if (newMat) localStorage.setItem('user_default_material', newMat);
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
          {/* 顶部导航 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm mb-3">
              <Link href="/quote/recognize" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700">
                <ArrowLeft size={14} /> 重新上传
              </Link>
              <span className="text-slate-300">|</span>
              <Link href="/quote" className="text-slate-500 hover:text-slate-700">手动报价</Link>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Layers size={24} className="text-blue-600" />
              {isAssembly ? '装配体零件列表' : '识别结果'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {isAssembly
                ? `识别到 ${totalParts} 个零件，点击零件卡片开始逐个报价`
                : '图纸识别完成，点击进入报价'}
              {payload.fileName && <span className="text-slate-400 ml-1">· {payload.fileName}</span>}
            </p>
          </div>

          {/* 批量设置材料（未设材料的零件默认使用此值） */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 shrink-0">批量材料</span>
              <select
                value={currentMaterial}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">暂不统一设置</option>
                {MATERIAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="text-xs text-slate-400 shrink-0">未单独设材料的零件将使用此值</span>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {payload.products.map((p, idx) => {
              const type = getPartType(p);
              const TypeIcon = type.icon;
              const isQuoted = quotedParts.has(idx);
              const isFailed = p._failed;

              return (
                <button
                  key={idx}
                  onClick={() => handlePartClick(idx)}
                  disabled={isFailed}
                  className={`text-left bg-white rounded-xl border p-4 shadow-sm transition-all group
                    ${isFailed ? 'opacity-50 cursor-not-allowed border-red-200 bg-red-50' :
                      isQuoted ? 'border-emerald-200 hover:shadow-md hover:border-emerald-300' :
                      'border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
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
                      </div>
                    </div>
                    {!isFailed && (
                      <ChevronRight size={18} className={`shrink-0 transition-transform ${isQuoted ? 'text-emerald-400' : 'text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5'}`} />
                    )}
                  </div>

                  {isFailed ? (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {p._error || '解析失败'}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Ruler size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{getPartDims(p)}</span>
                      </div>
                      {p.weight_g != null && (
                        <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                          <Box size={13} className="text-slate-400 shrink-0" />
                          <span>重 {p.weight_g}g{p.meter_weight != null ? ` / ${p.meter_weight}kg·m⁻¹` : ''}</span>
                        </div>
                      )}
                      {(p.punch_holes_total != null || p.cnc_total_holes != null) && (
                        <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                          <FileText size={13} className="text-slate-400 shrink-0" />
                          <span>
                            {(p.punch_holes_total ?? 0) > 0 && `${p.punch_holes_total}孔`}
                            {(p.cnc_total_holes ?? 0) > 0 && `${(p.punch_holes_total ?? 0) > 0 ? ' + ' : ''}CNC ${p.cnc_total_holes}孔`}
                          </span>
                        </div>
                      )}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {isQuoted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 size={14} /> 已报价
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600 font-semibold text-sm group-hover:text-blue-700">
                            点击进入报价 <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        )}
                        {p.material_grade ? <span className="text-slate-500 truncate ml-2 text-xs">材质: {p.material_grade}</span>
                          : currentMaterial ? <span className="text-slate-400 truncate ml-2 text-xs">材质: {currentMaterial} (批量)</span>
                          : <span className="text-amber-400 truncate ml-2 text-xs">材质: 待选择</span>}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* 材料选择弹窗 */}
          {materialModalIdx !== null && payload && (() => {
            const mp = payload.products[materialModalIdx];
            const mpName = getPartName(mp, materialModalIdx);
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMaterialModalIdx(null)}>
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-800">选择材料</h3>
                    <button onClick={() => setMaterialModalIdx(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">零件 <b>{mpName}</b> 需要选择材料才能报价</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MATERIAL_OPTIONS.map(m => (
                      <button
                        key={m}
                        onClick={() => handleModalMaterialSelect(m)}
                        className="px-3 py-2.5 text-sm rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-slate-700 font-medium"
                      >
                        {m}
                      </button>
                    ))}
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
