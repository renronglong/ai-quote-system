"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, History, CheckCircle2, FileSpreadsheet, Percent, Pencil, Upload, AlertCircle, Loader2, Lock, Save, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';


// 有效数字取整：单价3位，模具费/起订量2位
function sigfig(n: number, digits: number): number {
  if (n === 0 || !isFinite(n)) return n;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, digits - d);
  return Math.round(n * factor) / factor;
}
function r3sig(n: number): number { return sigfig(n, 3); }  // 价格三位有效数字
function r2sig(n: number): number { return Math.round(n); }

// ==================== Types ====================
export interface SavedQuote {
  id: string;
  date: string;
  product_type: string;
  params: Record<string, any>;
  result: Record<string, any>;
  name: string;
  product_discount?: number;
  mold_discount?: number;
  created_at?: string;
}

// ==================== API helpers ====================
function getHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

export async function loadSavedQuotes(userId: string): Promise<SavedQuote[]> {
  try {
    // no-store：删除/保存后必须拿到最新列表，避免浏览器缓存造成「删了还在」的错觉
    const res = await fetch(`/api/saved-quotes?user_id=${encodeURIComponent(userId)}`, { headers: getHeaders(), cache: 'no-store' });
    const json = await res.json();
    if (json.success) return json.data || [];
    return [];
  } catch {
    return [];
  }
}

export async function saveQuoteToAPI(
  userId: string,
  params: Record<string, any>,
  result: Record<string, any>,
  productType: string,
  productDiscount?: number,
  moldDiscount?: number,
  moldGroupId?: string,
  customName?: string,
): Promise<SavedQuote | null> {
  try {
    const name = customName || `报价-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}-${productType}`;
    const finalParams = moldGroupId ? { ...params, _mold_group_id: moldGroupId } : params;
    const res = await fetch(`/api/saved-quotes?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name,
        product_type: productType,
        params: finalParams,
        result,
        product_discount: productDiscount,
        mold_discount: moldDiscount,
      }),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

// 删除结果带明细分：旧版只看 json.success，而服务端「删 0 行」也返回 success，
// 导致「删除选中」点了没反应也看不到任何报错（业主 2026-11-11 反馈）。
export type DeleteResult = { ok: boolean; deleted: number; ids: string[]; error?: string };

async function callDelete(userId: string, ids: string[]): Promise<DeleteResult> {
  try {
    const qs = ids.length === 1 ? `id=${encodeURIComponent(ids[0])}` : `ids=${encodeURIComponent(ids.join(','))}`;
    const res = await fetch(`/api/saved-quotes?${qs}&user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { ok: false, deleted: 0, ids: [], error: json.error || `删除失败（HTTP ${res.status}）` };
    }
    return { ok: true, deleted: Number(json.deleted || 0), ids: json.ids || ids, error: undefined };
  } catch {
    return { ok: false, deleted: 0, ids: [], error: '网络错误，删除失败' };
  }
}

export async function deleteSavedQuoteAPI(userId: string, id: string): Promise<boolean> {
  return (await callDelete(userId, [id])).ok;
}

export async function deleteSavedQuotesBatchAPI(userId: string, ids: string[]): Promise<DeleteResult> {
  return callDelete(userId, ids);
}

// 报价单编号：与报价工作台 QuoteSheetDialog 共用同一天序列，避免同一天多张单相互覆盖
function nextQuoteNo(): string {
  const today = new Date();
  const d = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  let seq = 1;
  try {
    const saved = JSON.parse(localStorage.getItem('gyparts_quote_seq') || '{}');
    if (saved.date === d) seq = (saved.seq || 0) + 1;
  } catch { /* ignore */ }
  localStorage.setItem('gyparts_quote_seq', JSON.stringify({ date: d, seq }));
  return `GY${d}${String(seq).padStart(3, '0')}`;
}

// ==================== Export config ====================
export const EXPORT_SECTIONS = [
  { key: 'product_params', label: '产品参数（尺寸、材料等）', default: true },
  { key: 'cost_breakdown', label: '费用明细（各项费用）', default: true },
  { key: 'mold_info', label: '模具信息', default: true },
  { key: 'surface_info', label: '表面处理信息', default: true },
  { key: 'total_price', label: '合计总价', default: true },
] as const;

export type ExportSectionKey = typeof EXPORT_SECTIONS[number]['key'];

// ==================== Quote-sheet API types ====================
interface SheetItem {
  model?: string;
  spec?: string;
  name?: string;
  unit?: string;
  material?: string;
  surface?: string;
  price_ex_tax?: number;
  price_inc_tax?: number;
  moq?: number | string;
  mold_fee?: number | null;
  remark?: string;
}
interface SheetBody {
  supplier_company?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  supplier_address?: string;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  customer_address?: string;
  quote_no?: string;
  aluminum_price?: number;
  user_id?: string;
  customer_qq?: string;
  global_remark?: string;
  items: SheetItem[];
}

// ==================== Component ====================
// 「显示完整内容」：把保存报价里的 params / result 原样铺开，不做截断
function renderFullValue(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function FullContentGrid({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return <div className="text-xs text-gray-400">（无）</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-0.5 text-[11px] leading-relaxed min-w-0">
          <span className="shrink-0 text-gray-500">{k}</span>
          <span className="text-gray-800 break-all">：{renderFullValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

interface SavedQuotesPanelProps {
  userId: string;
  user?: any;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  onEditQuote?: (quote: SavedQuote) => void;
  /** drawer = 右侧抽屉（默认）；inline = 直接铺开渲染，供「我的报价」独立页面使用 */
  variant?: 'drawer' | 'inline';
}

export default function SavedQuotesPanel({ userId, user, trigger, onOpenChange, onEditQuote, variant = 'drawer' }: SavedQuotesPanelProps) {
  const isInline = variant === 'inline';
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSections, setExportSections] = useState<Set<ExportSectionKey>>(
    new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key))
  );
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [customerInfo, setCustomerInfo] = useState({ name: '', contact: '', phone: '', address: '' });
  const [globalRemark, setGlobalRemark] = useState('');
  const [supplierInfo, setSupplierInfo] = useState<{ company_name?: string; contact_name?: string; contact_phone?: string; address?: string }>({});
    const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // 待确认删除的报价 id
  // 批量删除：二次确认 + 真实结果反馈（业主反馈「删除选中功能无效」）
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [actionError, setActionError] = useState('');
  // 「显示完整内容」：每条报价可展开看全部参数与费用明细
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 导出弹窗「保存报价单」：存到子页面 /history/sheets
  const [saving, setSaving] = useState(false);
  const [savedQuoteNo, setSavedQuoteNo] = useState<string | null>(null);
  // ===== 批量导入客户（业主 2026-10-22：模板 /customer_import_template.xlsx）=====
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFile, setImportFile] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  // 导出弹窗·客户名称下拉（数据源 = 本机客户档案）
  const [custListOpen, setCustListOpen] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<{ name?: string; contact?: string; phone?: string; address?: string }[]>([]);

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await loadSavedQuotes(userId);
    setQuotes(data);
    setLoading(false);
  };

  // 加载报价历史（抽屉模式在打开时加载；独立页面模式进入即加载）
  useEffect(() => {
    if ((isInline || open) && userId) {
      reload();
    }
  }, [open, userId, isInline]);

  // 加载供方资料（不依赖对话框是否打开，确保随时可用）
  useEffect(() => {
    if (userId) {
      fetch(`/api/auth/profile?user_id=${encodeURIComponent(userId)}`)
        .then(r => r.json())
        .then(d => {
          if (d.data?.profile) {
            setSupplierInfo(d.data.profile);
          } else {
            console.warn('[SavedQuotesPanel] No profile data in response');
          }
        })
        .catch(err => {
          console.error('[SavedQuotesPanel] Failed to load profile:', err);
        });
    }
  }, [userId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === quotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quotes.map(q => q.id)));
    }
  };

  const handleDelete = async (id: string) => {
    const r = await deleteSavedQuoteAPI(userId, id);
    if (!r) {
      setActionError('删除失败：记录不存在或无权删除，请刷新后重试');
      return;
    }
    setActionError('');
    setQuotes(prev => prev.filter(q => q.id !== id)); // 先本地移除，避免等接口返回期间仍显示
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDeleteTarget(null);
    reload();
  };

  // 「删除选中」：一次请求批量删 + 二次确认 + 真实结果反馈，不再静默失败
  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeletingSelected(true);
    setActionError('');
    const r = await deleteSavedQuotesBatchAPI(userId, ids);
    setDeletingSelected(false);
    setDeleteSelectedOpen(false);
    if (!r.ok || r.deleted === 0) {
      setActionError(r.error || '删除失败，请刷新后重试');
      reload();
      return;
    }
    const done = new Set(r.ids.length ? r.ids : ids);
    setQuotes(prev => prev.filter(q => !done.has(q.id)));
    setSelectedIds(prev => {
      const n = new Set(prev);
      done.forEach(id => n.delete(id));
      return n;
    });
    reload();
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExportSection = (key: ExportSectionKey) => {
    setExportSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 将 SavedQuote 映射为 quote-sheet API 的 SheetItem
  // 与报价工作台 QuoteSheetDialog.toSheetItem 保持同一套规则：
  // 型号=模具编号、名称=产品库名称（类别名过滤）、规格=模具截面优先/尺寸兜底、材质=牌号/铝型材默认6063-T5、表面处理=产品库登记优先
  const mapToSheetItems = (qs: SavedQuote[]): SheetItem[] => {
    return qs.map(q => {
      const p = q.params || {};
      const r = q.result || {};
      const bd = r.breakdown || {};
      const dims = p.dimensions || {};
      const stdCat = dims.standard_category || p.standardCategory || p.standard_category || '';
      const isExtrusion = (p.productType || p.product_type) === '挤出' || stdCat !== '' || !!p.materialCategory;

      // 规格尺寸：模具库登记截面优先；否则按宽*高*长（兼容嵌套 dimensions 与平铺顶层两种存储）
      const w = dims.width_mm ?? p.width, h = dims.height_mm ?? p.height, l = dims.length_mm ?? p.length;
      const dw = dims.diameter_mm, od = dims.outer_diameter_mm, idm = dims.inner_diameter_mm, hx = dims.hex_flat_mm;
      let spec = '';
      if (p.moldCrossSection) spec = String(p.moldCrossSection).replace(/×/g, '*') + (l ? `*${l}` : '');
      else if (dw) spec = `ø${dw}` + (l ? `*${l}` : '');
      else if (od) spec = `ø${od}` + (idm ? `*${idm}` : '') + (l ? `*${l}` : '');
      else if (hx) spec = `H${hx}` + (idm ? `*${idm}` : '') + (l ? `*${l}` : '');
      else {
        const parts: string[] = [];
        if (w) parts.push(String(w));
        if (h) parts.push(String(h));
        if (l) parts.push(String(l));
        spec = parts.length > 0 ? parts.join('*') : (p.productSize || '');
      }

      // 表面处理：产品库登记原文优先；否则本次报价实际选择；无则空（不取材料表面处理 materialSurfaceTreatment）
      let surface = '';
      if (p.moldSurface) surface = String(p.moldSurface);
      else {
        // 表面处理 + 颜色，如「氧化」+「铁灰色」→ 氧化铁灰色
        const st = (p.surfaceTreatment && p.surfaceTreatment !== '无') ? String(p.surfaceTreatment) : '';
        const co = (p.surfaceColor && p.surfaceColor !== '无') ? String(p.surfaceColor) : '';
        surface = st ? (st + co) : '';
      }

      // 材质：牌号优先；铝型材缺省 6063-T5；其他品类显示材料类别
      let material = '';
      if (p.materialGrade) material = String(p.materialGrade);
      else if (dims?.material_grade) material = String(dims.material_grade);
      else if (isExtrusion) material = '6063-T5';
      else material = p.materialCategory || p.material?.category || '';

      // 产品名称：产品库登记名称优先，但类别名（如"异型材"）回退到用户手填名称
      const GENERIC = new Set(['异型材','标准件','铝型材','铝合金','型材','挤出','挤出铝型材','挤压铝型材','铝圆管','铝圆棒','铝方管','铝六角管','铝六角棒','铝方/扁棒','角铝','铝板','不锈钢','铝']);
      const moldName = String(p.moldProductName ?? '').trim();
      const name = (moldName && !GENERIC.has(moldName)) ? moldName
        : (p.productName || p.product_type || p.productType || q.product_type || '');

      const moqVal = Number(r.min_order_qty || 0);
      return {
        model: p.moldNumber || p.productCode || '',
        spec,
        name,
        unit: 'pcs',
        material,
        surface,
        price_ex_tax: r.unit_price != null ? r3sig(Number(r.unit_price)) : undefined,
        price_inc_tax: r.unit_price_inc_tax != null ? r3sig(Number(r.unit_price_inc_tax)) : (r.unit_price != null ? r3sig(Number(r.unit_price) * 1.13) : undefined),
        moq: moqVal > 0 ? r2sig(moqVal) : (p.quantity ? r2sig(Number(p.quantity)) : ''),
        mold_fee: bd.mold?.amount != null ? r2sig(Number(bd.mold.amount)) : (r.mold_cost != null ? r2sig(Number(r.mold_cost)) : null),
        remark: '',
      };
    });
  };

  // 弹窗「显示完整内容」：与导出/保存用的是同一份 12 列数据，所见即所得
  const previewItems = mapToSheetItems(quotes.filter(q => selectedIds.has(q.id)));

  const buildSheetBody = (quoteNo: string): SheetBody => ({
    supplier_company: supplierInfo.company_name || '',
    supplier_contact: supplierInfo.contact_name || '',
    supplier_phone: supplierInfo.contact_phone || '',
    supplier_address: supplierInfo.address || '',
    customer_name: customerInfo.name || undefined,
    customer_contact: customerInfo.contact || undefined,
    customer_phone: customerInfo.phone || undefined,
    customer_address: customerInfo.address || undefined,
    quote_no: quoteNo,
    user_id: userId || undefined,
    global_remark: globalRemark,
    items: previewItems,
  });

  // 导出弹窗「保存」：只落库存档、不下载；记录出现在子页面 /history/sheets，
  // 该页按导出报价单的 12 列格式完整展示。
  const handleSaveSheet = async () => {
    if (previewItems.length === 0) { setActionError('请先勾选至少一条报价'); return; }
    setSaving(true);
    setActionError('');
    setSavedQuoteNo(null);
    try {
      const quoteNo = nextQuoteNo();
      const resp = await fetch('/api/quote-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, quote_no: quoteNo, body: buildSheetBody(quoteNo) }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || '保存失败');
      setSavedQuoteNo(quoteNo);
    } catch (err: any) {
      setActionError(err?.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (previewItems.length === 0) return;

    setExporting(true);
    setActionError('');
    try {
      const items = previewItems;
      const body = buildSheetBody(nextQuoteNo());

      const res = await fetch('/api/quote-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Export failed');
      }

      const data = await res.json();
      const dateStr = new Date().toISOString().slice(0, 10);

      if (exportFormat === 'excel') {
        // Excel: decode base64 and download
        const bin = atob(data.xlsx_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `报价单_${dateStr}_${items.length}条.xlsx`);
      } else {
        // PDF: decode base64 and download
        const bin = atob(data.pdf_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadBlob(blob, `报价单_${dateStr}_${items.length}条.pdf`);
      }

      setExportSuccess(true);
      setTimeout(() => { setExportSuccess(false); setExportDialogOpen(false); }, 1200);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('导出失败：' + (err?.message || '请重试'));
    } finally {
      setExporting(false);
    }
  };

  const openExportDialog = () => {
    setExportSections(new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key)));
    setExportFormat('excel');
    setExportSuccess(false);
    setCustomerInfo({ name: '', contact: '', phone: '', address: '' });
    setGlobalRemark('');
    setActionError('');
    setSavedQuoteNo(null);
    // 载入本机客户档案（批量导入/历史导出保存的客户），供客户名称下拉选择
    try { setLocalCustomers(JSON.parse(localStorage.getItem('gyparts_customer_profiles') || '[]')); } catch { setLocalCustomers([]); }
    setExportDialogOpen(true);
  };

  // ==================== 批量导入客户 ====================
  // 模板：/customer_import_template.xlsx（业主 2026-10-22 版 10 列：
  // 客户名称/统一社会信用代码/地址/电话/开户行名称/银行账号/电子邮箱/客户分类/简码/联系人）
  // 兼容早期 7 列模板（客户编号/公司名称/联系人/电话/地址/邮箱/备注）。
  // 管理员 / 员工任一凭证即可导入（业主 2026-10-22：开放给员工账号，数据按账号隔离）

  /** 归一化列名后按别名取单元格值（空返回 ''） */
  const pickByAlias = (obj: Record<string, any>, aliases: string[]): string => {
    const norm = (s: any) => String(s ?? '').replace(/\s/g, '').toLowerCase();
    for (const [k, v] of Object.entries(obj)) {
      const hk = norm(k);
      if (aliases.some(a => hk.includes(norm(a)))) return String(v ?? '').trim();
    }
    return '';
  };

  const resetImport = () => {
    setImportRows([]);
    setImportFile('');
    setImportResult(null);
    setImportError('');
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const parseCustomerFile = (file: File) => {
    setImportFile(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        // 找表头行（前 5 行内含「客户名称 / 公司名称 / 客户编号」的那一行）
        let hIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const joined = (rows[i] || []).map(c => String(c ?? '')).join('');
          if (/客户名称|公司名称|客户编号/.test(joined)) { hIdx = i; break; }
        }
        if (hIdx < 0) {
          setImportError('未识别到表头，请确保首行包含「客户名称」列');
          setImportRows([]);
          return;
        }
        const headers = (rows[hIdx] || []).map(c => String(c ?? '').trim());
        const items: any[] = [];
        for (let r = hIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          if (!row.length) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, ci) => { if (h) obj[h] = row[ci]; });
          const company_name = pickByAlias(obj, ['客户名称', '公司名称', '客户单位', '单位名称']);
          if (!company_name) continue; // 空行 / 无客户名跳过
          const contact_name = pickByAlias(obj, ['联系人']);
          const phone = pickByAlias(obj, ['电话', '手机']);
          const address = pickByAlias(obj, ['地址']);
          const email = pickByAlias(obj, ['电子邮箱', '邮箱', '邮件']);
          const taxNo = pickByAlias(obj, ['信用代码', '识别号', '税号']);
          const bankName = pickByAlias(obj, ['开户行']);
          const bankAccount = pickByAlias(obj, ['银行账号', '银行帐号', '账号', '帐号']);
          const category = pickByAlias(obj, ['客户分类', '分类']);
          const shortCode = pickByAlias(obj, ['简码', '客户编号', '客户代码']);
          const oldRemark = pickByAlias(obj, ['备注']);
          // 开票信息客户表无独立列（税号/开户行/账号/分类/简码）→ 合并进备注保留，不丢数据
          const extra = [
            taxNo ? `税号:${taxNo}` : '',
            bankName ? `开户行:${bankName}` : '',
            bankAccount ? `银行账号:${bankAccount}` : '',
            category ? `客户分类:${category}` : '',
            shortCode ? `简码:${shortCode}` : '',
          ].filter(Boolean).join('；');
          const remarks = [oldRemark, extra].filter(Boolean).join('；');
          items.push({
            company_name,
            contact_name: contact_name || undefined,
            phone: phone || undefined,
            address: address || undefined,
            email: email || undefined,
            remarks: remarks || undefined,
            // 有简码/客户编号则作为唯一编码（重复导入按编号更新，不产生重复记录）；否则后端自动生成 KH######
            customer_code: shortCode || undefined,
          });
        }
        if (!items.length) {
          setImportError('未解析到有效数据行（「客户名称」列不能为空）');
          setImportRows([]);
          return;
        }
        setImportRows(items);
        setImportError('');
      } catch (err: any) {
        setImportError('解析失败：' + (err?.message || '文件格式有误'));
        setImportRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /** 把解析出的客户写入本机客户档案（导出报价单的客户下拉读 localStorage，按浏览器/账号隔离） */
  const writeLocalCustomers = (): number => {
    const KEY = 'gyparts_customer_profiles';
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    for (const it of importRows) {
      if (!it?.company_name) continue;
      const rec = {
        name: String(it.company_name),
        contact: String(it.contact_name || ''),
        phone: String(it.phone || ''),
        address: String(it.address || ''),
        qq: '',
      };
      const i = list.findIndex((x: any) => x.name === rec.name);
      if (i >= 0) list[i] = { ...list[i], ...rec }; else list.unshift(rec);
    }
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
    return importRows.length;
  };

  const runImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      // 统一本机导入（业主 2026-10-22：保密要求 —— 客户信息仅本人可见，任何账号都无法查看他人的）
      // customers 表 user_id 外键指向 auth.users，与自建用户表不通，服务端无法按账号归属存储；
      // 本机客户档案（gyparts_customer_profiles）正是导出报价单客户下拉的数据源，天然按账号/浏览器隔离。
      const n = writeLocalCustomers();
      setImportResult({ success: n, fail: 0, errors: [] });
    } catch (err: any) {
      setImportError('导入失败：' + (err?.message || '请重试'));
    } finally {
      setImporting(false);
    }
  };

  const fmt = (v: any) => {
    if (v == null || isNaN(v)) return '¥0.00';
    return `¥${Number(v).toFixed(2)}`;
  };

  const getDiscountedPrice = (quote: SavedQuote): { unitPrice: string; isDiscounted: boolean } => {
    const orig = quote.result?.unit_price || 0;
    const pd = quote.product_discount;
    if (pd && pd < 100) {
      return { unitPrice: fmt(orig * (pd / 100)), isDiscounted: true };
    }
    return { unitPrice: fmt(orig), isDiscounted: false };
  };

  // 列表主体：抽屉与独立页面共用同一份实现，保证两处功能与行为完全一致
  const listBody = (
    <>
      <div className={isInline ? 'space-y-2 mt-4' : 'flex-1 overflow-y-auto pr-2 space-y-2 mt-4'}>
          {actionError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600" aria-label="关闭提示">✕</button>
            </div>
          )}
          {loading && (
            <div className="text-center py-4 text-sm text-gray-400">加载中...</div>
          )}
          {!loading && quotes.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              暂无保存的报价记录
            </div>
          )}

          {quotes.length > 0 && (
            <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer py-2 -my-2 shrink-0">
                <Checkbox
                  checked={quotes.length > 0 && selectedIds.size === quotes.length}
                  onCheckedChange={toggleSelectAll}
                />
                全选{selectedIds.size > 0 ? `（已选 ${selectedIds.size}）` : ''}
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteSelectedOpen(true)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs h-9 px-3">
                    <Trash2 className="w-3.5 h-3.5" /> 删除选中（{selectedIds.size}）
                  </Button>
                )}
                {/* 导入客户（业主 2026-10-22） */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-1.5 text-xs"
                  onClick={() => { resetImport(); setImportOpen(true); }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  导入客户
                </Button>
                {/* 导出按钮置顶（业主 2026-10-22：放底部要滚动才看得见） */}
                <Button
                  size="sm"
                  className="h-9 px-3 gap-1.5 text-xs"
                  disabled={selectedIds.size === 0}
                  onClick={openExportDialog}
                >
                  <Download className="w-3.5 h-3.5" />
                  导出报价单{selectedIds.size > 0 ? `（${selectedIds.size}）` : ''}
                </Button>
                {isInline && (
                  <Link href="/history/sheets"
                    className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white text-xs text-blue-600 hover:bg-blue-50">
                    <FileSpreadsheet className="w-3.5 h-3.5" />已保存报价单<ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {quotes.map(quote => {
            const { unitPrice, isDiscounted } = getDiscountedPrice(quote);
            const p = quote.params || {};
            const r = quote.result || {};
            const dims = p.dimensions || {};
            const specParts = [dims.width_mm ?? p.width, dims.height_mm ?? p.height, dims.length_mm ?? p.length]
              .filter(v => v !== undefined && v !== null && v !== '').map(String);
            const spec = p.moldCrossSection ? String(p.moldCrossSection).replace(/×/g, '*') : (specParts.join('*') || p.productSize || '-');
            const material = p.materialGrade || dims.material_grade || p.materialCategory || p.material?.category || '-';
            const st = p.surfaceTreatment && p.surfaceTreatment !== '无' ? String(p.surfaceTreatment) : '';
            const co = p.surfaceColor && p.surfaceColor !== '无' ? String(p.surfaceColor) : '';
            const surface = p.moldSurface ? String(p.moldSurface) : (st + co || '-');
            const moldFee = r.mold_cost ?? r.breakdown?.mold?.amount;
            const moq = r.min_order_qty || p.quantity || '-';
            const expanded = expandedIds.has(quote.id);
            const InfoCell = ({ label, value }: { label: string; value: any }) => (
              <div className="min-w-0 text-[12px] leading-relaxed">
                <span className="text-gray-400">{label}：</span>
                <span className="text-gray-700 break-all">{value === '' || value == null ? '-' : String(value)}</span>
              </div>
            );
            return (
              <div
                key={quote.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedIds.has(quote.id)
                    ? 'border-blue-400 bg-blue-50/50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedIds.has(quote.id)}
                    onCheckedChange={() => toggleSelect(quote.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 break-words whitespace-normal">{quote.name}</span>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-emerald-600">{unitPrice}</span>
                        {isDiscounted && (
                          <div className="text-[11px] text-gray-400 line-through">
                            {fmt(r.unit_price)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[12px] text-gray-400 mt-0.5">
                      {new Date(quote.date || quote.created_at || '').toLocaleString('zh-CN')}
                      {' · '}{quote.product_type || '-'}
                    </div>
                    {/* 完整内容常显摘要：名称不再截断，关键字段全部铺开 */}
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
                      <InfoCell label="数量" value={p.quantity || '-'} />
                      <InfoCell label="材质" value={material} />
                      <InfoCell label="规格" value={spec} />
                      <InfoCell label="表面处理" value={surface} />
                      <InfoCell label="模具费" value={moldFee != null ? fmt(moldFee) : '-'} />
                      <InfoCell label="起订量" value={moq} />
                      <InfoCell label="含税单价" value={r.unit_price_inc_tax != null ? fmt(r.unit_price_inc_tax) : (r.unit_price != null ? fmt(Number(r.unit_price) * 1.13) : '-')} />
                      <InfoCell label="合计" value={r.total_price != null ? fmt(r.total_price) : '-'} />
                    </div>
                    {(quote.product_discount || quote.mold_discount) && (
                      <div className="text-[11px] text-orange-500 flex items-center gap-0.5 mt-1">
                        <Percent className="w-3 h-3" />
                        {quote.product_discount && quote.product_discount < 100 && `产品${quote.product_discount}%折`}
                        {quote.product_discount && quote.product_discount < 100 && quote.mold_discount && quote.mold_discount < 100 && ' '}
                        {quote.mold_discount && quote.mold_discount < 100 && `模具${quote.mold_discount}%折`}
                      </div>
                    )}
                    <button onClick={() => toggleExpanded(quote.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起完整内容</> : <><ChevronDown className="w-3.5 h-3.5" />查看完整内容</>}
                    </button>
                    {expanded && (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-slate-50 p-3 space-y-2">
                        <div className="text-xs font-semibold text-gray-700">产品参数（完整）</div>
                        <FullContentGrid data={p} />
                        <div className="text-xs font-semibold text-gray-700 pt-1 border-t border-gray-200">报价结果（完整）</div>
                        <FullContentGrid data={r} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditQuote?.(quote)}
                      className="flex items-center justify-center h-11 w-11 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      title="编辑此报价"
                      aria-label="编辑此报价"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(quote.id)}
                      className="flex items-center justify-center h-11 w-11 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="删除此报价"
                      aria-label="删除此报价"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 批量导入客户弹窗（业主 2026-10-22） */}
        <Dialog open={importOpen} onOpenChange={(o) => { if (!importing) { setImportOpen(o); if (!o) resetImport(); } }}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" /> 批量导入客户
              </DialogTitle>
            </DialogHeader>

            {/* 保密说明（业主 2026-10-22：导入的客户仅本人可见，不存在共享库） */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-white border border-slate-200 text-slate-600">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span>
                <b>保密说明：</b>您导入的客户信息仅保存在您本机、<b>仅您本人可见</b>。其他任何账号（包括管理员）都无法查看，
                也不会被共享或挪作他用。导出报价单时，客户下拉仅显示您自己保存的客户。
              </span>
            </div>

            <div className="space-y-3">
              {/* 1. 下载模板 */}
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">1</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 mb-1.5">下载模板</div>
                  <a
                    href="/customer_import_template.xlsx"
                    download="客户信息导入模板.xlsx"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    下载 Excel 模板
                  </a>
                  <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    列：客户名称 · 信用代码/税号 · 地址 · 电话 · 开户行 · 银行账号 · 邮箱 · 客户分类 · 简码 · 联系人（仅客户名称必填）
                  </div>
                </div>
              </div>

              {/* 2. 选择文件 */}
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">2</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 mb-1.5">选择填好的 Excel</div>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      importRows.length > 0 ? 'border-green-400 bg-white' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
                    }`}
                    onClick={() => importInputRef.current?.click()}
                  >
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCustomerFile(f); }}
                    />
                    {importRows.length > 0 ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-gray-700 truncate max-w-[280px]">{importFile}</span>
                        <span className="text-xs text-gray-500">已解析 {importRows.length} 条 · 点击重选</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">点击选择 .xlsx / .xls 文件</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. 预览 */}
              {importRows.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">3</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 mb-1.5">确认预览</div>
                    <div className="max-h-[190px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
                      <table className="w-full text-[11px] table-fixed">
                        <thead className="bg-white text-slate-500 sticky top-0 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 font-medium w-[26%]">客户名称</th>
                            <th className="text-left px-2 py-1.5 font-medium w-[13%]">联系人</th>
                            <th className="text-left px-2 py-1.5 font-medium w-[17%]">电话</th>
                            <th className="text-left px-2 py-1.5 font-medium">地址</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 20).map((r, i) => (
                            <tr key={i} className="border-t border-gray-100 bg-white">
                              <td className="px-2.5 py-1 truncate text-gray-800" title={r.company_name}>{r.company_name}</td>
                              <td className="px-2 py-1 truncate text-gray-600">{r.contact_name || '-'}</td>
                              <td className="px-2 py-1 truncate text-gray-600">{r.phone || '-'}</td>
                              <td className="px-2 py-1 truncate text-gray-500" title={r.address}>{r.address || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importRows.length > 20 && (
                        <div className="text-[11px] text-gray-400 px-2.5 py-1 bg-white border-t border-gray-100">…共 {importRows.length} 条，仅预览前 20 条</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {importError && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
              {importResult && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed border ${importResult.fail > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    导入完成：成功 <b>{importResult.success}</b> 条{importResult.fail > 0 && <>，失败 <b className="text-red-600">{importResult.fail}</b> 条</>}
                  </div>
                  {importResult.errors.length === 0 && <div className="mt-0.5 text-[11px] opacity-80">已写入本机客户档案，导出报价单时可直接选用，仅本人可见。</div>}
                  {importResult.errors.length > 0 && (
                    <div className="mt-1.5 max-h-[90px] overflow-y-auto text-red-600 space-y-0.5">
                      {importResult.errors.slice(0, 8).map((e, i) => <div key={i}>· {e}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={() => { setImportOpen(false); resetImport(); }} disabled={importing}>
                关闭
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={runImport}
                disabled={importing || importRows.length === 0 || !!importResult}
              >
                {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 导入中…</> : <>开始导入{importRows.length ? `（${importRows.length}）` : ''}</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 批量导出 / 保存弹窗（业主 2026-11-11：加宽显示完整内容 + 增加保存） */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>导出 / 保存报价单</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="text-xs text-gray-500 mb-1">
                  已选择 <span className="font-semibold text-gray-700">{selectedIds.size}</span> 条报价
                </div>

                {/* 导出格式 */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">导出格式</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat('excel')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                        exportFormat === 'excel'
                          ? 'border-emerald-500 bg-white text-emerald-600 font-medium'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                        exportFormat === 'pdf'
                          ? 'border-emerald-500 bg-white text-emerald-600 font-medium'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>

                {/* 客户信息 */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">客户信息（选填）</div>
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="客户名称（点击选择已保存的客户）"
                        value={customerInfo.name}
                        onChange={e => setCustomerInfo(p => ({ ...p, name: e.target.value }))}
                        onFocus={() => { if (localCustomers.length > 0) setCustListOpen(true); }}
                        onBlur={() => { window.setTimeout(() => setCustListOpen(false), 120); }}
                      />
                      {custListOpen && localCustomers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-y-auto">
                          {localCustomers
                            .filter(c => !customerInfo.name.trim() || String(c.name || '').toLowerCase().includes(customerInfo.name.trim().toLowerCase()))
                            .slice(0, 50)
                            .map((c, i) => (
                              <div
                                key={i}
                                className="px-2.5 py-1.5 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0"
                                onMouseDown={() => {
                                  setCustomerInfo({ name: c.name || '', contact: c.contact || '', phone: c.phone || '', address: c.address || '' });
                                  setCustListOpen(false);
                                }}
                              >
                                <span className="text-gray-800">{c.name}</span>
                                {c.contact && <span className="text-xs text-gray-400 ml-2">{c.contact}</span>}
                                {c.phone && <span className="text-xs text-gray-400 ml-2">{c.phone}</span>}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="联系人"
                        value={customerInfo.contact}
                        onChange={e => setCustomerInfo(p => ({ ...p, contact: e.target.value }))}
                      />
                      <input
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="电话"
                        value={customerInfo.phone}
                        onChange={e => setCustomerInfo(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <input
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="地址"
                      value={customerInfo.address}
                      onChange={e => setCustomerInfo(p => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 全局备注（导出报价单底部） */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">全局备注（选填）</div>
                  <textarea
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[44px] resize-none"
                    placeholder="备注信息（显示在报价单底部）"
                    value={globalRemark}
                    onChange={e => setGlobalRemark(e.target.value)}
                  />
                </div>

                {/* 显示完整内容：与导出 Excel/PDF 同一套 12 列数据，所见即所得 */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">
                    报价单完整内容（{previewItems.length} 项 · 与导出报价单格式一致）
                  </div>
                  <div className="max-h-[240px] overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full text-[11px] border-collapse bg-white" style={{ minWidth: 900 }}>
                      <thead className="bg-blue-50 sticky top-0">
                        <tr>
                          {['序号', '客户型号', '规格尺寸mm', '产品名称', '单位', '材质', '表面处理', '单价未税(元)', '含税价', '最小起订量', '模具费RMB(元)', '备注'].map(h => (
                            <th key={h} className="border border-gray-200 px-1.5 py-1.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewItems.map((it, i) => (
                          <tr key={i}>
                            <td className="border border-gray-200 px-1.5 py-1 text-center">{i + 1}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.model || ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.spec || ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.name || ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center">{it.unit || 'pcs'}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.material || ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.surface || ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-right">{it.price_ex_tax ?? ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-right">{it.price_inc_tax ?? ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-center">{it.moq ?? ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1 text-right">{it.mold_fee ?? ''}</td>
                            <td className="border border-gray-200 px-1.5 py-1">{it.remark || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewItems.length === 0 && (
                      <div className="text-xs text-gray-400 py-4 text-center">请先勾选报价</div>
                    )}
                  </div>
                </div>

                {savedQuoteNo && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="flex-1">报价单 {savedQuoteNo} 已保存，格式与导出报价单一致。</span>
                    <Link href="/history/sheets" className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
                      查看已保存报价单 <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
                {actionError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                <Link href="/history/sheets"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <FileSpreadsheet className="w-3.5 h-3.5" />已保存报价单<ExternalLink className="w-3 h-3" />
                </Link>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleSaveSheet}
                    disabled={saving || exporting || previewItems.length === 0}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4" /> 保存报价单</>}
                  </Button>
                  <Button className="gap-2" onClick={handleExport} disabled={exporting || saving || previewItems.length === 0}>
                    {exporting ? (
                      <>导出中...</>
                    ) : exportSuccess ? (
                      <><CheckCircle2 className="w-4 h-4" /> 已导出</>
                    ) : (
                      <><Download className="w-4 h-4" /> 导出 {exportFormat === 'excel' ? 'Excel' : 'PDF'}</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
        </Dialog>

        {/* 删除确认弹窗（P1-2：不可逆操作二次确认） */}
        <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle>确认删除报价？</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 py-2">
              此操作不可恢复，删除后该条报价将从「我的报价」中永久移除。
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (deleteTarget) {
                    await handleDelete(deleteTarget);
                    setDeleteTarget(null);
                  }
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 批量删除确认（业主 2026-11-11：「删除选中功能无效」→ 改成一次批量删 + 明确反馈） */}
        <Dialog open={deleteSelectedOpen} onOpenChange={(o) => { if (!deletingSelected) setDeleteSelectedOpen(o); }}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle>确认删除选中的 {selectedIds.size} 条报价？</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 py-2">
              此操作不可恢复，删除后这些报价将从「我的报价」中永久移除。
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setDeleteSelectedOpen(false)}
                disabled={deletingSelected}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingSelected}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deletingSelected && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deletingSelected ? '删除中...' : '全部删除'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
    </>
  );

  // 独立页面模式：「我的报价」页面直接用这一支（页头已有大标题，这里只显示条数）
  if (isInline) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <History className="w-4 h-4 text-blue-600" />
          共 {quotes.length} 条已保存报价
        </div>
        {listBody}
      </div>
    );
  }

  // 默认：右侧抽屉模式
  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <History className="w-4 h-4" />
            已保存报价
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            已保存报价（{quotes.length}）
          </SheetTitle>
        </SheetHeader>
        {listBody}
      </SheetContent>
    </Sheet>
  );
}

// ==================== Helper ====================
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
