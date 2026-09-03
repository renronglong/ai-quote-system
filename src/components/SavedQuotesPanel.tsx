"use client";
import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, History, CheckCircle2, FileSpreadsheet, Percent } from 'lucide-react';

// 有效数字取整：单价3位，模具费/起订量2位
function sigfig(n: number, digits: number): number {
  if (n === 0 || !isFinite(n)) return n;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, digits - d);
  return Math.round(n * factor) / factor;
}
function r3sig(n: number): number { return Math.round(n * 100) / 100; }  // 价格统一2位小数
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
function getHeaders(userId: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-user-id': userId };
}

export async function loadSavedQuotes(userId: string): Promise<SavedQuote[]> {
  try {
    const res = await fetch('/api/saved-quotes', { headers: getHeaders(userId) });
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
    const res = await fetch('/api/saved-quotes', {
      method: 'POST',
      headers: getHeaders(userId),
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

export async function deleteSavedQuoteAPI(userId: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/saved-quotes?id=${id}`, {
      method: 'DELETE',
      headers: getHeaders(userId),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
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
interface SavedQuotesPanelProps {
  userId: string;
  user?: any;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function SavedQuotesPanel({ userId, user, trigger, onOpenChange }: SavedQuotesPanelProps) {
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

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await loadSavedQuotes(userId);
    setQuotes(data);
    setLoading(false);
  };

  // 加载报价历史
  useEffect(() => {
    if (open && userId) {
      reload();
    }
  }, [open, userId]);

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
    await deleteSavedQuoteAPI(userId, id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    reload();
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) {
      await deleteSavedQuoteAPI(userId, id);
    }
    setSelectedIds(new Set());
    reload();
  };

  const toggleExportSection = (key: ExportSectionKey) => {
    setExportSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 将 SavedQuote 映射为 quote-sheet API 的 SheetItem
  const mapToSheetItems = (qs: SavedQuote[]): SheetItem[] => {
    return qs.map(q => {
      const p = q.params || {};
      const r = q.result || {};
      const bd = r.breakdown || {};
      // 规格尺寸：挤出类 dimensions.width_mm/height_mm/length_mm；圆棒/圆管/六角带专属字段
      const dims = p.dimensions || {};
      const w = dims.width_mm, h = dims.height_mm, l = dims.length_mm;
      const dw = dims.diameter_mm, od = dims.outer_diameter_mm, idm = dims.inner_diameter_mm, hx = dims.hex_flat_mm;
      let spec = '';
      if (dw) spec = `ø${dw}` + (l ? `×${l}` : '');
      else if (od) spec = `ø${od}` + (idm ? `×${idm}` : '') + (l ? `×${l}` : '');
      else if (hx) spec = `H${hx}` + (idm ? `×${idm}` : '') + (l ? `×${l}` : '');
      else {
        const parts: string[] = [];
        if (w) parts.push(String(w));
        if (h) parts.push(String(h));
        if (l) parts.push(String(l));
        spec = parts.length > 0 ? parts.join('*') : (p.productSize || '');
      }
      const moqVal = Number(r.min_order_qty || 0);
      return {
        model: q.name || '',
        spec,
        name: p.productName || p.product_type || p.productType || q.product_type || '',
        unit: 'pcs',
        material: p.materialCategory || p.material?.category || '',
        surface: p.surfaceTreatment || p.materialSurfaceTreatment || '',
        price_ex_tax: r.unit_price != null ? r3sig(Number(r.unit_price)) : undefined,
        price_inc_tax: r.unit_price_inc_tax != null ? r3sig(Number(r.unit_price_inc_tax)) : (r.unit_price != null ? r3sig(Number(r.unit_price) * 1.13) : undefined),
        moq: moqVal > 0 ? r2sig(moqVal) : '',
        mold_fee: bd.mold?.amount != null ? r2sig(Number(bd.mold.amount)) : (r.mold_cost != null ? r2sig(Number(r.mold_cost)) : null),
        remark: '',
      };
    });
  };

  const handleExport = async () => {
    const selectedQuotes = quotes.filter(q => selectedIds.has(q.id));
    if (selectedQuotes.length === 0) return;

    setExporting(true);
    try {
      const items = mapToSheetItems(selectedQuotes);
      const body: SheetBody = {
        supplier_company: supplierInfo.company_name || '',
        supplier_contact: supplierInfo.contact_name || '',
        supplier_phone: supplierInfo.contact_phone || '',
        supplier_address: supplierInfo.address || '',
        customer_name: customerInfo.name || undefined,
        customer_contact: customerInfo.contact || undefined,
        customer_phone: customerInfo.phone || undefined,
        customer_address: customerInfo.address || undefined,
        quote_no: `GY${new Date().toISOString().slice(0,10).replace(/-/g,'')}001`,
        user_id: userId || undefined,
        global_remark: globalRemark,
        items,
      };

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
    setExportDialogOpen(true);
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

        <div className="flex-1 overflow-y-auto pr-2 space-y-2 mt-4">
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
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Checkbox
                  checked={quotes.length > 0 && selectedIds.size === quotes.length}
                  onCheckedChange={toggleSelectAll}
                />
                全选
              </label>
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="text-red-500 hover:text-red-600 text-xs h-7">
                  删除选中
                </Button>
              )}
            </div>
          )}

          {quotes.map(quote => {
            const { unitPrice, isDiscounted } = getDiscountedPrice(quote);
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{quote.name}</span>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-emerald-600">{unitPrice}</span>
                        {isDiscounted && (
                          <div className="text-[10px] text-gray-400 line-through">
                            {fmt(quote.result?.unit_price)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(quote.date || quote.created_at || '').toLocaleString('zh-CN')}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-gray-500">
                        {quote.params?.quantity || 0}件 · {quote.params?.materialCategory || quote.params?.material?.category || '-'}
                      </span>
                      {(quote.product_discount || quote.mold_discount) && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <Percent className="w-3 h-3" />
                          {quote.product_discount && quote.product_discount < 100 && `产品${quote.product_discount}%折`}
                          {quote.product_discount && quote.product_discount < 100 && quote.mold_discount && quote.mold_discount < 100 && ' '}
                          {quote.mold_discount && quote.mold_discount < 100 && `模具${quote.mold_discount}%折`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(quote.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 批量导出 */}
        <div className="pt-3 border-t border-gray-200 mt-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <Button
              className="w-full gap-2"
              disabled={selectedIds.size === 0}
              onClick={openExportDialog}
            >
              <Download className="w-4 h-4" />
              批量导出报价单（{selectedIds.size}）
            </Button>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>导出报价单</DialogTitle>
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
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                        exportFormat === 'pdf'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
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
                    <input
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="客户名称"
                      value={customerInfo.name}
                      onChange={e => setCustomerInfo(p => ({ ...p, name: e.target.value }))}
                    />
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
              </div>
              <div className="flex justify-between mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportSections(new Set(EXPORT_SECTIONS.map(s => s.key)))}
                >
                  全选
                </Button>
                <Button className="gap-2" onClick={handleExport} disabled={exportSections.size === 0 || exporting}>
                  {exporting ? (
                    <>导出中...</>
                  ) : exportSuccess ? (
                    <><CheckCircle2 className="w-4 h-4" /> 已导出</>
                  ) : (
                    <><Download className="w-4 h-4" /> 导出 {exportFormat === 'excel' ? 'Excel' : 'PDF'}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
