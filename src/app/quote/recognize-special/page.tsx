"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Upload, Loader2, Info, AlertCircle } from 'lucide-react';
import QuoteSidebarLayout from '@/components/QuoteSidebarLayout';

/**
 * /quote/recognize-special — 业主 2026-11-13 任务表「修改任务」第 3 条
 *
 * 「材料类别」右侧「图纸识别」按钮进入。按当前料型（query: type）显式调用
 * 《gyparts 专用材料识别接口契约》里的对应专用端点：
 *   extrusion / sheet / casting / injection / steel
 * 走同域代理 /api/recognize-special?type=xxx（服务端转发到 8000，避免 HTTPS→HTTP mixed-content）。
 *
 * 契约要点：后端专用端点只返回几何/识图数据，不输出重量；
 * 重量由前端按 material_grade 取密度计算（本页展示，不进入任何报价公式）。
 */

type RecogType = 'extrusion' | 'sheet' | 'casting' | 'injection' | 'steel';

const TYPES: { key: RecogType; label: string; endpoint: string }[] = [
  { key: 'extrusion', label: '挤出铝型材', endpoint: '/api/recognize/extrusion' },
  { key: 'sheet', label: '板材 / 钣金', endpoint: '/api/recognize/sheet' },
  { key: 'casting', label: '铸造', endpoint: '/api/recognize/casting' },
  { key: 'injection', label: '注塑', endpoint: '/api/recognize/injection' },
  { key: 'steel', label: '钢材', endpoint: '/api/recognize/steel' },
];

// 契约第五节：密度 g/mm³，material_grade 模糊匹配（含子串即命中），未匹配回退铝
const DENSITY: { keys: string[]; rho: number; label: string }[] = [
  { keys: ['不锈钢', 'stainless'], rho: 0.00793, label: '不锈钢' },
  { keys: ['黄铜', 'brass'], rho: 0.00850, label: '黄铜' },
  { keys: ['铜', 'copper'], rho: 0.00896, label: '铜' },
  { keys: ['钢', 'steel', '铁', 'Q235', '45#'], rho: 0.00785, label: '钢' },
  { keys: ['铝', 'aluminum', '6063', '6061', '5052'], rho: 0.00270, label: '铝' },
];

function densityOf(grade: string): { rho: number; label: string } {
  const g = (grade || '').toLowerCase();
  for (const d of DENSITY) {
    if (d.keys.some(k => g.includes(k.toLowerCase()))) return { rho: d.rho, label: d.label };
  }
  return { rho: 0.00270, label: '铝（默认）' };
}

const FIELD_LABELS: Record<string, string> = {
  success: '识别成功', parse_success: '解析成功', process_type: '加工类型',
  process_type_cn: '类型中文', is_sheet_metal: '是否钣金', source_type: '来源',
  material_grade: '材料牌号', thickness_mm: '板厚(mm)', error: '错误',
  length_mm: '型材长度(mm)', cw_mm: '截面宽(mm)', ch_mm: '截面高(mm)',
  volume_mm3: '实体体积(mm³)', section_area_mm2: '截面面积(mm²)',
  bounding_section_area_mm2: '包围截面(mm²)', is_hollow: '是否空心',
  n_faces: '面数', n_solids: '实体数', section_size: '截面尺寸',
  section_width_mm: '截面宽/外形宽(mm)', section_height_mm: '截面高/外形高(mm)',
  extrusion_length_mm: '长度(mm)', bend_count: '折弯数',
  unfold_length_mm: '展开长(mm)', unfold_width_mm: '展开宽(mm)',
  unfold_area_mm2: '展开面积(mm²)', cut_perimeter_mm: '切割周长(mm)',
  cut_total_path_mm: '切割总路径(mm)', punch_holes_total: '冲孔数',
  cnc_total_holes: 'CNC孔数', hole_count: '孔数', area_mm2: '面积(mm²)',
  perimeter_mm: '周长(mm)', confidence: '置信度', parse_method: '解析方式',
  surface_treatment: '表面处理', needs_review: '需人工复核',
};

export default function RecognizeSpecialPage() {
  const [type, setType] = useState<RecogType>('extrusion');
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState('');
  const [grade, setGrade] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [thickness, setThickness] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');

  // 从 /quote 的「材料类别」按钮带 type 进来；用 window.location 读，避免 useSearchParams 的 Suspense 约束
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('type');
    if (t && TYPES.some(x => x.key === t)) setType(t as RecogType);
  }, []);

  const current = TYPES.find(t => t.key === type)!;

  // 前端按契约第五节算重量（仅展示，不进报价）
  const weightEstimate = useMemo(() => {
    if (!result) return null;
    const d = densityOf(String(result.material_grade || grade || ''));
    const area = Number(result.section_area_mm2 ?? result.unfold_area_mm2 ?? result.area_mm2 ?? 0);
    const thick = Number(result.thickness_mm ?? thickness ?? 0);
    const out: { label: string; value: string }[] = [];
    if (type === 'extrusion' && area > 0) {
      // 米重 kg/m = 截面面积 mm² × 密度 g/mm³
      out.push({ label: '估算米重', value: `${(area * d.rho).toFixed(4)} kg/m` });
    } else if (type === 'sheet' && area > 0 && thick > 0) {
      // 单件重 g = 展开面积 mm² × 板厚 mm × 密度 g/mm³
      out.push({ label: '估算单件重', value: `${(area * thick * d.rho).toFixed(2)} g` });
    }
    return out.length ? { density: d, items: out } : null;
  }, [result, type, grade, thickness]);

  async function submit() {
    setError('');
    if (!file && !fileId.trim()) { setError('请选择图纸文件，或填写已上传的 file_id'); return; }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      else fd.append('file_id', fileId.trim());
      if (sourceType) fd.append('source_type', sourceType);
      if (grade.trim()) fd.append('material_grade', grade.trim());
      if (thickness.trim()) fd.append('thickness_mm', thickness.trim());
      const res = await fetch(`/api/recognize-special?type=${type}`, { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { setError(j.error || j.detail || `请求失败 (${res.status})`); return; }
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }

  const entries = useMemo(() => {
    if (!result) return [];
    return Object.entries(result)
      .filter(([k]) => k !== 'notes' && k !== '_proxy' && result[k] !== null && result[k] !== undefined)
      .map(([k, v]) => ({
        key: k,
        label: FIELD_LABELS[k] || k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
  }, [result]);

  return (
    <QuoteSidebarLayout>
    <div className="min-h-full bg-slate-50 text-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Link href="/quote" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={16} /> 返回报价
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" /> 图纸识别（专用接口）
          </h1>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600 mb-4 flex items-start gap-2">
          <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            按料型显式调用专用端点，避免自动分类把型材误判成钣金。当前端点：
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-blue-700">{current.endpoint}</code>
            。后端只返回几何数据，<b>重量由前端按材料牌号密度计算</b>（本页仅供查看，不进入报价）。
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">材料大类</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as RecogType)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">来源类型（可选，不传自动判断）</label>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">自动判断</option>
                <option value="step">step（STEP 建议显式指定，精度最高）</option>
                <option value="pdf">pdf</option>
                <option value="image">image</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">材料牌号（可选，如 6063 / 铝 / 不锈钢）</label>
              <input
                value={grade}
                onChange={e => setGrade(e.target.value)}
                placeholder="影响前端密度与重量估算"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            {type === 'sheet' && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">板厚 mm（算重量用）</label>
                <input
                  value={thickness}
                  onChange={e => setThickness(e.target.value)}
                  inputMode="decimal"
                  placeholder="如 1.5"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">图纸文件（图片 / PDF / STEP）</label>
              <input
                type="file"
                accept=".stp,.step,.igs,.iges,.pdf,.png,.jpg,.jpeg,.webp,.dxf,.dwg"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">或填已上传 file_id（二选一）</label>
              <input
                value={fileId}
                onChange={e => setFileId(e.target.value)}
                placeholder="服务器已有文件标识，免重复上传"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {loading ? '识别中…' : '开始识别'}
            </button>
            <span className="text-xs text-slate-400">支持 STP/STEP · PDF · JPG/PNG；STEP 精度最高</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-slate-800">识别结果</h2>
              <span className={`text-xs rounded-full px-2.5 py-1 ${result.success === false ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {result.success === false ? '识别失败' : '识别成功'}
              </span>
            </div>

            {Array.isArray(result.notes) && result.notes.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {result.notes.map((n: any, i: number) => <div key={i}>· {typeof n === 'string' ? n : JSON.stringify(n)}</div>)}
              </div>
            )}
            {result.needs_review && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                该结果置信度不足（needs_review），建议提供 STEP 或人工复核后再报价。
              </div>
            )}

            {weightEstimate && (
              <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-slate-700">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {weightEstimate.items.map(w => (
                    <span key={w.label}>{w.label}：<b className="text-blue-700">{w.value}</b></span>
                  ))}
                  <span className="text-xs text-slate-500">密度按 {weightEstimate.density.label} {weightEstimate.density.rho} g/mm³，前端估算、不进报价</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-2 pr-3 font-medium">字段</th>
                    <th className="py-2 pr-3 font-medium">说明</th>
                    <th className="py-2 font-medium">值</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.key} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-xs text-slate-400">{e.key}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{e.label}</td>
                      <td className="py-1.5 break-all text-slate-800">{e.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </QuoteSidebarLayout>
  );
}
