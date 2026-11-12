"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileImage, ShieldAlert, ChevronDown, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * /quote/parts/inspect — 业主 2026-11-12 任务表「修改任务」第 1 条
 *  1) 零件列表「加工方式」右侧按钮 → 本子网页显示后端给出的图纸
 *  2) 本页再加一个链接 → 查看后端给出的全部信息并翻译成通俗语言（管理员测试用，普通用户看不了）
 *
 * 图纸来源：后端 A 稍后会在识别/解析响应里补图纸字段。本页不写死字段名，
 * 而是通用探测「值像图片/PDF 的 URL 或 base64」的任意字段，后端改好即自动显示。
 * 后端全部信息：buildRecogDataFromParse 里挂的 _rawBackend（原始完整响应）。
 */

type DrawingSource = { label: string; url: string; kind: 'image' | 'pdf' | 'link' };

/** 递归找后端响应里任何像图纸的字段；限制深度与数量，避免误抓 OCR 长文本。 */
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

/** 后端字段 → 中文大白话 */
const FIELD_LABELS: Record<string, string> = {
  file_name: '文件名', file_type: '文件类型', file_size_kb: '文件大小(KB)', parser_version: '解析器版本',
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

export default function PartsInspectPage() {
  const { loading: authLoading, isAdmin } = useAuth();
  const [idx, setIdx] = useState(0);
  const [fileName, setFileName] = useState('');
  const [raw, setRaw] = useState<any>({});
  const [showRaw, setShowRaw] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const i = Math.max(0, Number(q.get('i') || 0) || 0);
      setIdx(i);
      if (q.get('raw') === '1') setShowRaw(true);
      const payload = JSON.parse(sessionStorage.getItem('ai_quote_parts') || '{}');
      const p = Array.isArray(payload?.products) ? (payload.products[i] || null) : null;
      setFileName(String(payload?.fileName || p?._fileName || ''));
      let backend = p?._rawBackend;
      if (!backend) {
        try { const recog = JSON.parse(sessionStorage.getItem('ai_quote_recog_result') || '{}'); backend = recog?.recogData || recog; } catch { /* ignore */ }
      }
      setRaw(backend || p || {});
    } catch { /* 无数据则显示空态 */ }
    setLoaded(true);
  }, []);

  const drawings = useMemo(() => findDrawingSources(raw), [raw]);
  const summary = useMemo(() => makePlainSummary(raw), [raw]);
  const entries = useMemo(() => {
    const o = raw && typeof raw === 'object' ? raw : {};
    return Object.entries(o as Record<string, unknown>)
      .filter(([k]) => k !== '_rawBackend')
      .map(([k, v]) => ({ key: k, label: FIELD_LABELS[k] || k, value: formatValue(v), long: typeof v === 'object' && v !== null }));
  }, [raw]);

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

        {/* ① 后端给出的图纸 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <FileImage size={18} className="text-blue-600" />
            <h2 className="font-medium">后端给出的图纸</h2>
            {drawings.length > 0 && <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">共 {drawings.length} 张</span>}
          </div>
          {!loaded ? (
            <div className="text-sm text-slate-400 py-8 text-center">读取中…</div>
          ) : drawings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Info size={22} className="mx-auto mb-2 text-slate-400" />
              <div className="text-sm font-medium text-slate-600 mb-1">后端暂未返回图纸</div>
              <div className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto">
                当前识别/解析响应里只有文字和数值，没有图片地址。后端补上图纸字段后本页会自动显示，
                无需再改前端：支持图片 URL、PDF URL、data:image / data:application/pdf，字段名不限。
              </div>
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

        {/* ② 后端全部信息（管理员专属） */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-2 mb-2">
            <ShieldAlert size={18} className="text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-medium">后端给出的全部信息</h2>
              <p className="text-xs text-slate-500 mt-0.5">把后端原始返回翻译成通俗语言，供管理员测试核对。普通用户不可见。</p>
            </div>
          </div>

          {authLoading ? (
            <div className="text-sm text-slate-400 py-4">检查权限中…</div>
          ) : !isAdmin ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              仅管理员可查看后端原始信息。普通用户看到的图纸区不受影响。
            </div>
          ) : (
            <>
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
          )}
        </section>

        <p className="text-xs text-slate-400 mt-4 text-center">
          数据来源：本次图纸识别的后端原始响应（保存在当前浏览器会话中）
        </p>
      </div>
    </div>
  );
}
