"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Layers, CheckCircle2, Clock,
  ChevronRight, ArrowRight, Package, Ruler, Box, Info, AlertCircle
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
    // 存当前选中零件索引和完整数据，跳转报价页
    sessionStorage.setItem('ai_quote_selected_idx', String(idx));
    sessionStorage.setItem('ai_quote_selected_part', JSON.stringify(part));
    router.push('/quote?from=parts');
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
      if (p.thickness_mm != null) parts.push(`×${p.thickness_mm}`);
      else if (p.wall_thickness != null) parts.push(`×${p.wall_thickness}`);
      if (p.bend_count > 0) parts.push(`${p.bend_count}折`);
      return parts.join(' ') || '-';
    }
    // 挤压
    const parts: string[] = [];
    if (p.width != null && p.height != null) parts.push(`${p.width}×${p.height}`);
    if (p.wall_thickness != null) parts.push(`×t${p.wall_thickness}`);
    if (p.length != null) parts.push(`L${p.length}`);
    return parts.join(' ') || '-';
  };

  const getPartName = (p: PartData, idx: number): string => {
    if (p._partName) return p._partName;
    if (p._fileName) return p._fileName;
    if (p.product_code) return p.product_code;
    if (p.product_name) return p.product_name;
    return `零件${idx + 1}`;
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
                          {p._quantity > 1 && (
                            <span className="text-xs text-slate-500">×{p._quantity}件</span>
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
                            {p.punch_holes_total > 0 && `${p.punch_holes_total}孔`}
                            {p.cnc_total_holes > 0 && `${p.punch_holes_total > 0 ? ' + ' : ''}CNC ${p.cnc_total_holes}孔`}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        {isQuoted ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={12} /> 已报价
                          </span>
                        ) : (
                          <span className="text-blue-600 font-medium group-hover:text-blue-700">点击报价 →</span>
                        )}
                        {p.material_grade && <span className="text-slate-400 truncate ml-2">{p.material_grade}</span>}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* 底部提示 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">使用提示</p>
                <ul className="text-blue-700 space-y-0.5 text-xs leading-relaxed">
                  <li>• 点击零件卡片进入报价页面，AI参数已预填，确认无误后点击「计算报价」并保存</li>
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
